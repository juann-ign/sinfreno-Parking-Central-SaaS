"""Dinero, recuperación y rollback con aplicación/autenticación/PostgreSQL reales."""
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from starlette.websockets import WebSocketDisconnect

from app.core.database import SessionLocal
from app.models import db_models as m
from main import app
from scripts.access_test_data import PASSWORD, reset_and_seed

API = "/api/v1"
ORIGIN = os.environ.get("TEST_FRONTEND_ORIGIN", "http://127.0.0.1:15175")


@pytest.fixture
def data():
    if os.environ.get("RELEASE_ALLOW_RESET") != "1":
        pytest.skip("Requiere el PostgreSQL descartable de release")
    return reset_and_seed()


@pytest.fixture
def client(data):
    assert not app.dependency_overrides
    with TestClient(app, raise_server_exceptions=False) as instance:
        yield instance


def auth(client, name="op_a1"):
    response = client.post(API + "/auth/login", data={"username": f"{name}@sf02a.example.com", "password": PASSWORD})
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def command(headers, key=None):
    return {**headers, "Idempotency-Key": key or str(uuid4())}


def quote(client, headers, stay_id=1):
    response = client.post(API + f"/parking/{stay_id}/cotizaciones", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def confirm(client, headers, stay_id, q, key=None, box=1, method="EFECTIVO"):
    return client.post(API + f"/parking/{stay_id}/salida", headers=command(headers, key),
                       json={"cotizacion_id": q["id"], "caja_id": box, "metodo_pago": method})


def test_quote_is_read_only_valid_until_expiry_and_confirm_uses_shown_amount(client, data):
    actor = auth(client)
    with SessionLocal() as db:
        before = db.get(m.Estadia, data["active"][0])
        state = (before.estado, before.monto, before.fecha_salida_utc, before.usuario_salida_id, before.caja_id)
    q = quote(client, actor, data["active"][0])
    assert q["estadia_id"] == data["active"][0] and q["sucursal_id"] == data["branches"][0]
    assert datetime.fromisoformat(q["vence_en"]) > datetime.fromisoformat(q["calculada_en"])
    with SessionLocal() as db:
        stay = db.get(m.Estadia, data["active"][0])
        assert (stay.estado, stay.monto, stay.fecha_salida_utc, stay.usuario_salida_id, stay.caja_id) == state
        assert db.query(m.Auditoria).count() == 0
        db.get(m.Sucursal, data["branches"][0]).tarifa_auto = Decimal("9999.00")
        db.commit()
    result = confirm(client, actor, data["active"][0], q)
    assert result.status_code == 200, result.text
    assert Decimal(result.json()["monto"]) == Decimal(q["monto"])
    assert result.json()["caja_id"] == 1


def test_new_entry_snapshot_survives_configuration_change_and_zero_grace(client):
    actor = auth(client)
    admin = auth(client, "admin_a1")
    assert client.patch(API + "/parking/config", headers=admin, json={"tiempo_cortesia_min": 0, "tarifa_auto": "1000.00"}).status_code == 200
    entry = client.post(API + "/parking/ingreso", headers=command(actor),
                        json={"patente": "SNAP001", "torre_id": 1, "tipo": "AUTO", "caja_id": 1})
    assert entry.status_code == 200, entry.text
    stay_id = entry.json()["id"]
    assert client.patch(API + "/parking/config", headers=admin, json={"tiempo_cortesia_min": 120, "tarifa_auto": "9999.00"}).status_code == 200
    q = quote(client, actor, stay_id)
    assert q["origen_reglas"] == "INGRESO"
    assert Decimal(q["monto"]) == 1000
    assert q["explicacion"]["cortesia_minutos"] == 0


def test_expired_quote_reconfirms_and_does_not_mutate(client, data):
    actor = auth(client)
    q = quote(client, actor, data["active"][0])
    with SessionLocal() as db:
        db.get(m.Cotizacion, q["id"]).vence_en = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    result = confirm(client, actor, data["active"][0], q)
    assert result.status_code == 409 and result.json()["detail"]["code"] == "COTIZACION_VENCIDA"
    with SessionLocal() as db:
        assert db.get(m.Estadia, data["active"][0]).estado == "ACTIVO"
        decision = db.query(m.OperacionIdempotente).one()
        assert "_rechazo_idempotente" in decision.respuesta
        assert db.query(m.Auditoria).count() == 0


def test_persisted_rejection_cannot_execute_later_when_capacity_changes(client, data):
    actor = auth(client)
    with SessionLocal() as db:
        db.get(m.Torre, 1).capacidad = 1  # El fixture ya ocupa su única plaza.
        db.commit()
    key = str(uuid4())
    body = {"patente": "LATE001", "torre_id": 1, "tipo": "AUTO", "caja_id": 1}
    rejected = client.post(API + "/parking/ingreso", headers=command(actor, key), json=body)
    assert rejected.status_code == 409
    assert rejected.headers["Idempotency-Resolved"] == "true"
    with SessionLocal() as db:
        db.get(m.Torre, 1).capacidad = 2
        db.commit()
    replay = client.post(API + "/parking/ingreso", headers=command(actor, key), json=body)
    assert replay.status_code == 409 and replay.json() == rejected.json()
    assert replay.headers["Idempotency-Replayed"] == "true"
    recovered = client.get(API + f"/parking/operaciones/INGRESO/{key}", headers=actor)
    assert recovered.status_code == 409 and recovered.headers["Idempotency-Resolved"] == "true"
    with SessionLocal() as db:
        assert not db.query(m.Vehiculo).filter_by(patente="LATE001").first()
    assert client.post(API + "/parking/ingreso", headers=command(actor), json=body).status_code == 200


def test_persisted_replay_never_charges_new_stay_with_same_plate(client, data):
    actor = auth(client)
    stay_id = data["active"][0]
    q = quote(client, actor, stay_id)
    key = str(uuid4())
    first = confirm(client, actor, stay_id, q, key)
    assert first.status_code == 200
    with SessionLocal() as db:
        db.get(m.Cotizacion, q["id"]).vence_en = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()
    new_entry = client.post(API + "/parking/ingreso", headers=command(actor),
                            json={"patente": "FIX1ACT", "torre_id": 1, "tipo": "MOTO", "caja_id": 1})
    assert new_entry.status_code == 200
    new_id = new_entry.json()["id"]
    replay = confirm(client, actor, stay_id, q, key)
    assert replay.status_code == 200 and replay.json() == first.json()
    assert replay.headers["Idempotency-Replayed"] == "true"
    recovered = client.get(API + f"/parking/operaciones/SALIDA/{key}", headers=actor)
    assert recovered.status_code == 200 and recovered.json() == first.json()
    assert confirm(client, actor, stay_id, q, key, method="QR").status_code == 409
    with SessionLocal() as db:
        assert db.get(m.Estadia, new_id).estado == "ACTIVO"
        assert db.query(m.Auditoria).filter_by(accion="COBRO_SALIDA").count() == 1


@pytest.mark.parametrize("other", ["exit", "op_a2", "op_b1", "viewer", "root"])
def test_quote_confirmation_and_recovery_do_not_grant_access_by_id_or_key(client, data, other):
    owner = auth(client)
    q = quote(client, owner, data["active"][0])
    outsider = auth(client, other)
    assert client.get(API + f"/parking/cotizaciones/{q['id']}", headers=outsider).status_code in (403, 404)
    assert confirm(client, outsider, data["active"][0], q).status_code in (403, 404)
    key = str(uuid4())
    assert confirm(client, owner, data["active"][0], q, key).status_code == 200
    assert client.get(API + f"/parking/operaciones/SALIDA/{key}", headers=outsider).status_code in (403, 404)


def test_cash_required_for_mutations_quote_without_cash_and_payment_current_shift(client, data):
    actor, admin = auth(client), auth(client, "admin_a1")
    close = client.post(API + "/cash/1/cerrar", headers=command(admin), json={"monto_real": "0.00", "notas": "Corte sintético"})
    assert close.status_code == 200
    entry = client.post(API + "/parking/ingreso", headers=command(actor),
                        json={"patente": "CLOSED1", "torre_id": 1, "tipo": "AUTO", "caja_id": 1})
    assert entry.status_code == 409
    q = quote(client, actor, data["active"][0])
    assert confirm(client, actor, data["active"][0], q).status_code == 409
    opened = client.post(API + "/cash/abrir", headers=command(admin), json={"notas": "Nuevo turno"})
    assert opened.status_code == 200
    next_box = opened.json()["id"]
    paid = confirm(client, actor, data["active"][0], q, box=next_box)
    assert paid.status_code == 200 and paid.json()["caja_id"] == next_box
    assert Decimal(client.get(API + "/cash/status", headers=admin).json()["recaudacion_total"]) == Decimal(q["monto"])


def test_cash_mixed_methods_reference_and_notes_preserved(client, data):
    actor, admin = auth(client), auth(client, "admin_a1")
    stay_ids = []
    for plate, category in [("MIX1000", "AUTO"), ("MIX2000", "CAMIONETA")]:
        response = client.post(API + "/parking/ingreso", headers=command(actor),
                               json={"patente": plate, "torre_id": 1, "tipo": category, "caja_id": 1})
        assert response.status_code == 200
        stay_ids.append(response.json()["id"])
    with SessionLocal() as db:
        for stay_id, rate in zip(stay_ids, ("1000.00", "2000.00")):
            stay = db.get(m.Estadia, stay_id)
            stay.fecha_entrada_utc = datetime.now(timezone.utc) - timedelta(minutes=20)
            stay.reglas_ingreso = {"categoria": stay.tipo_vehiculo, "tarifa_hora": rate, "porcentaje_descuento": "0", "cortesia_minutos": 10, "fraccion_minutos": 15}
        db.commit()
    for stay_id, method in zip(stay_ids, ("EFECTIVO", "QR")):
        assert confirm(client, actor, stay_id, quote(client, actor, stay_id), method=method).status_code == 200
    status = client.get(API + "/cash/status", headers=admin).json()
    assert Decimal(status["recaudacion_total"]) == 3000
    assert Decimal(status["monto_esperado"]) == 1000
    closed = client.post(API + "/cash/1/cerrar", headers=command(admin), json={"monto_real": "1000.00", "notas": "Caja mixta de prueba"})
    assert closed.status_code == 200, closed.text
    assert Decimal(closed.json()["diferencia"]) == 0
    assert Decimal(closed.json()["totales_por_medio"]["QR"]) == 2000
    assert closed.json()["notas"] == "Caja mixta de prueba"


def test_soft_delete_preserves_history_and_revokes_login_http_and_live_socket(client, data):
    actor, admin = auth(client), auth(client, "admin_a1")
    with client.websocket_connect("/ws/1", headers={"Origin": ORIGIN}) as ws:
        ws.send_json({"type": "authenticate", "token": actor["Authorization"].removeprefix("Bearer ")})
        assert ws.receive_json() == {"type": "authenticated"}
        result = client.delete(API + f"/auth/users/{data['users']['op_a1']}", headers=admin)
        assert result.status_code == 200 and result.json()["activo"] is False
        assert client.get(API + "/parking/config", headers=actor).status_code == 401
        assert client.post(API + "/auth/login", data={"username": "op_a1@sf02a.example.com", "password": PASSWORD}).status_code == 401
        ws.send_json({"type": "ping"})
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
        assert closed.value.code == 4401
    with SessionLocal() as db:
        assert db.get(m.Usuario, data["users"]["op_a1"]).activo is False
        assert db.get(m.Estadia, data["historic"][0]).usuario_salida_id == data["users"]["op_a1"]


@pytest.mark.parametrize("category", ["", " ", "BICICLETA", "<b>MARCADOR_LOCAL</b>"])
def test_invalid_category_rejected_before_persistence(client, category):
    result = client.post(API + "/parking/ingreso", headers=command(auth(client)),
                         json={"patente": "BADTYPE", "torre_id": 1, "tipo": category, "caja_id": 1})
    assert result.status_code == 422
    with SessionLocal() as db:
        assert not db.query(m.Vehiculo).filter_by(patente="BADTYPE").first()


@pytest.mark.parametrize("amount", ["NaN", "Infinity", "-1.00"])
def test_cash_count_rejects_nonfinite_and_negative_amounts(client, amount):
    result = client.post(API + "/cash/1/cerrar", headers=command(auth(client, "admin_a1")),
                         json={"monto_real": amount})
    assert result.status_code == 422
    with SessionLocal() as db:
        assert db.get(m.CierreCaja, 1).estado == "ABIERTA"


def test_client_cannot_supply_an_arbitrary_charge_amount(client, data):
    actor = auth(client)
    q = quote(client, actor, data["active"][0])
    result = client.post(API + f"/parking/{data['active'][0]}/salida", headers=command(actor),
                         json={"cotizacion_id": q["id"], "caja_id": 1, "metodo_pago": "EFECTIVO", "monto": "0.01"})
    assert result.status_code == 422
    with SessionLocal() as db:
        assert db.get(m.Estadia, data["active"][0]).estado == "ACTIVO"


def test_legacy_date_requires_explicit_admin_review_and_current_rules_are_labelled(client, data):
    actor, admin = auth(client), auth(client, "admin_a1")
    with SessionLocal() as db:
        db.get(m.Estadia, data["active"][0]).fecha_entrada_utc = None
        db.commit()
    denied = client.post(API + f"/parking/{data['active'][0]}/cotizaciones", headers=actor)
    assert denied.status_code == 409
    path = API + f"/parking/{data['active'][0]}/revisar-fecha"
    body = {"fecha_entrada_utc": (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat(), "motivo": "Revisión sintética autorizada del horario"}
    assert client.post(path, headers=actor, json=body).status_code == 403
    assert client.post(path, headers=admin, json=body).status_code == 200
    assert quote(client, actor, data["active"][0])["origen_reglas"] == "HEREDADO_CONFIG_ACTUAL"


@pytest.mark.parametrize("action", ["INGRESO_VEHICULO", "COBRO_SALIDA", "CIERRE_CAJA"])
def test_actual_postgresql_persistence_failure_rolls_back_whole_operation(client, data, action):
    actor, admin = auth(client), auth(client, "admin_a1")
    q = quote(client, actor, data["active"][0])
    key = str(uuid4())
    with SessionLocal() as db:
        db.execute(text("""CREATE OR REPLACE FUNCTION release_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.accion = TG_ARGV[0] THEN RAISE EXCEPTION 'CONTROLLED_RELEASE_TEST_FAILURE'; END IF; RETURN NEW; END $$"""))
        db.execute(text(f"CREATE TRIGGER release_test_fail_audit BEFORE INSERT ON auditoria FOR EACH ROW EXECUTE FUNCTION release_test_fail_audit('{action}')"))
        db.commit()
    try:
        if action == "INGRESO_VEHICULO":
            result = client.post(API + "/parking/ingreso", headers=command(actor, key), json={"patente": "ROLLBACK", "torre_id": 1, "tipo": "AUTO", "caja_id": 1})
        elif action == "COBRO_SALIDA":
            result = confirm(client, actor, data["active"][0], q, key)
        else:
            result = client.post(API + "/cash/1/cerrar", headers=command(admin, key), json={"monto_real": "0.00"})
        assert result.status_code == 500
        with SessionLocal() as db:
            stay = db.get(m.Estadia, data["active"][0])
            assert stay.estado == "ACTIVO" and stay.fecha_salida_utc is None and stay.caja_id is None and stay.monto == 0
            assert db.get(m.CierreCaja, 1).estado == "ABIERTA"
            assert not db.query(m.Vehiculo).filter_by(patente="ROLLBACK").first()
            assert not db.query(m.OperacionIdempotente).filter_by(clave=key).first()
            assert db.query(m.Auditoria).count() == 0
    finally:
        with SessionLocal() as db:
            db.execute(text("DROP TRIGGER IF EXISTS release_test_fail_audit ON auditoria"))
            db.execute(text("DROP FUNCTION IF EXISTS release_test_fail_audit()"))
            db.commit()

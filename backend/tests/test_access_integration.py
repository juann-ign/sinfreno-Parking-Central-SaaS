"""Rutas reales + autenticación real + PostgreSQL descartable. No usa auth overrides.

Ejecutar sólo en el PostgreSQL NUEVO de release con RELEASE_ALLOW_RESET=1.
Cada caso reinicia exclusivamente esa base identificada por nombre/usuario/host.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
import jwt
from starlette.websockets import WebSocketDisconnect

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import db_models as m
from main import app
from scripts.access_test_data import PASSWORD, reset_and_seed
import os

ORIGIN = os.environ.get("TEST_FRONTEND_ORIGIN", "http://127.0.0.1:15175")
API = "/api/v1"


@pytest.fixture
def data():
    if os.environ.get("RELEASE_ALLOW_RESET") != "1":
        pytest.skip("Requiere PostgreSQL release descartable y RELEASE_ALLOW_RESET=1")
    return reset_and_seed()


@pytest.fixture
def client(data):
    assert not app.dependency_overrides
    with TestClient(app) as instance:
        yield instance


def login(client, name="admin_a1"):
    response = client.post(API + "/auth/login", data={"username": f"{name}@sf02a.example.com", "password": PASSWORD})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def headers(client, name="admin_a1"):
    return {"Authorization": "Bearer " + login(client, name)}


def command_headers(auth, key=None):
    return {**auth, "Idempotency-Key": key or str(uuid4())}


def enter(client, auth, payload, caja_id=1):
    return client.post(API + "/parking/ingreso", headers=command_headers(auth),
                       json={"caja_id": caja_id, **payload})


def checkout(client, auth, stay_id, caja_id=1, method="EFECTIVO"):
    quote = client.post(API + f"/parking/{stay_id}/cotizaciones", headers=auth)
    assert quote.status_code == 200, quote.text
    return client.post(API + f"/parking/{stay_id}/salida", headers=command_headers(auth),
                       json={"cotizacion_id": quote.json()["id"], "caja_id": caja_id, "metodo_pago": method})


def signed(subject, seconds=60, **claims):
    return jwt.encode({"sub": subject, "exp": datetime.now(timezone.utc) + timedelta(seconds=seconds), **claims},
                      settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def authenticate_ws(ws, token):
    ws.send_json({"type": "authenticate", "token": token})
    assert ws.receive_json() == {"type": "authenticated"}


@pytest.mark.parametrize("token", [None, "invalid.token", "expired", "nonnumeric", "huge", "zero", "missing-exp", "unknown-user"])
def test_invalid_auth_is_controlled(client, data, token):
    tokens = {
        "expired": signed(str(data["users"]["admin_a1"]), -1),
        "nonnumeric": signed("not-a-user"), "huge": signed("9" * 80), "zero": signed("0"),
        "missing-exp": jwt.encode({"sub": "1"}, settings.SECRET_KEY, algorithm=settings.ALGORITHM),
        "unknown-user": signed("2147483647"),
    }
    auth = {"Authorization": "Bearer " + tokens.get(token, token)} if token else {}
    response = client.get(API + "/parking/config", headers=auth)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_invalid_password_and_persisted_hash(client, data):
    assert client.post(API + "/auth/login", data={"username": "admin_a1@sf02a.example.com", "password": "wrong"}).status_code == 401
    with SessionLocal() as db:
        db.get(m.Usuario, data["users"]["admin_a1"]).password_hash = "broken-hash"
        db.commit()
    assert client.post(API + "/auth/login", data={"username": "admin_a1@sf02a.example.com", "password": PASSWORD}).status_code == 401


@pytest.mark.parametrize("role", ["SUPERADMIN", "superAdmin", " SuperAdmin ", "ROOT", "ADMINISTRADOR"])
def test_admin_cannot_create_global_or_unknown_role(client, role):
    with SessionLocal() as db:
        before = db.query(m.Usuario).count()
    response = client.post(API + "/auth/users", headers=headers(client), json={
        "email": "attempt@sf02a.example.com", "password": PASSWORD, "rol": role, "permisos": ["ingreso"]})
    assert response.status_code == 422
    with SessionLocal() as db:
        assert db.query(m.Usuario).count() == before


@pytest.mark.parametrize("body", [
    {"permisos": ["all"]}, {"permisos": ["SUPERADMIN"]},
    {"permisos": ["config_sucursal"]}, {"sucursal_id": 2}, {"empresa_id": 2},
])
def test_manipulated_staff_fields_do_not_insert(client, body):
    request = {"email": "attempt@sf02a.example.com", "password": PASSWORD, "rol": "OPERADOR", "permisos": ["ingreso"], **body}
    response = client.post(API + "/auth/users", headers=headers(client), json=request)
    assert response.status_code == 422
    with SessionLocal() as db:
        assert not db.query(m.Usuario).filter_by(email=request["email"]).first()


@pytest.mark.parametrize("role", ["operador", "ADMIN"])
def test_valid_local_user_inherits_branch(client, data, role):
    response = client.post(API + "/auth/users", headers=headers(client), json={
        "email": "created@sf02a.example.com", "password": PASSWORD, "rol": role, "permisos": ["ingreso", "salida"]})
    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        user = db.query(m.Usuario).filter_by(email="created@sf02a.example.com").one()
        assert user.sucursal_id == data["branches"][0]
        assert user.rol == role.upper()
    assert client.post(API + "/auth/login", data={"username": "created@sf02a.example.com", "password": PASSWORD}).status_code == 200


def test_jwt_claims_cannot_expand_database_identity(client, data):
    token = signed(str(data["users"]["op_a1"]), rol="SUPERADMIN", permisos=["all"], sucursal_id=data["branches"][2])
    auth = {"Authorization": "Bearer " + token}
    assert client.get(API + "/superadmin/global-stats", headers=auth).status_code == 403
    assert client.get(API + "/parking/config", headers=auth).json()["id"] == data["branches"][0]
    assert client.post(API + "/auth/users", headers=auth, json={"email": "forged@sf02a.example.com", "password": PASSWORD}).status_code == 403


@pytest.mark.parametrize("name", ["admin_a1", "op_a1"])
def test_local_roles_cannot_provision(client, name):
    auth = headers(client, name)
    assert client.get(API + "/superadmin/global-stats", headers=auth).status_code == 403
    response = client.post(API + "/superadmin/provision", headers=auth, json={
        "nombre_empresa": "Forbidden", "cuit": "NOPE", "email_admin": "nope@example.com", "password_admin": PASSWORD})
    assert response.status_code == 403
    with SessionLocal() as db:
        assert db.query(m.Empresa).count() == 2


def test_superadmin_only_explicit_global_routes(client):
    auth = headers(client, "root")
    assert client.get(API + "/superadmin/global-stats", headers=auth).status_code == 200
    for path in ["/parking/config", "/parking/activas", "/stats/summary", "/cash/status", "/auth/users"]:
        assert client.get(API + path, headers=auth).status_code == 403


def test_superadmin_keeps_explicit_global_provisioning(client):
    result = client.post(API + "/superadmin/provision", headers=headers(client, "root"), json={
        "nombre_empresa": "Synthetic provision", "cuit": "SF02A-NEW", "email_admin": "newadmin@sf02a.example.com", "password_admin": PASSWORD})
    assert result.status_code == 200, result.text
    with SessionLocal() as db:
        user = db.query(m.Usuario).filter_by(email="newadmin@sf02a.example.com").one()
        assert user.rol == "ADMIN" and user.sucursal.empresa.nombre == "Synthetic provision"
    logged = client.post(API + "/auth/login", data={"username": "newadmin@sf02a.example.com", "password": PASSWORD})
    assert logged.status_code == 200


@pytest.mark.parametrize("name", ["entry", "exit", "viewer", "history", "finance"])
def test_legitimate_profiles_keep_minimum_dashboard_reads(client, name):
    auth = headers(client, name)
    for route in ("/parking/config", "/parking/activas", "/stats/summary", "/cash/status"):
        assert client.get(API + route, headers=auth).status_code == 200
    summary = client.get(API + "/stats/summary", headers=auth).json()
    assert ("recaudacion_hoy" in summary) == (name == "finance")


def test_effective_permissions_refresh_from_database_and_trim_known_csv(client, data):
    auth = headers(client, "viewer")
    with SessionLocal() as db:
        db.get(m.Usuario, data["users"]["viewer"]).permisos = " ingreso, salida,unknown,config_sucursal "
        db.commit()
    me = client.get(API + "/auth/me", headers=auth)
    assert me.status_code == 200
    assert set(me.json()["permisos"]) == {"ingreso", "salida"}
    assert enter(client, auth, {"patente": "TRIM123", "tipo": "AUTO", "torre_id": 1}).status_code == 200
    unknown = headers(client, "unknown")
    for route in ("/parking/config", "/parking/activas", "/stats/summary"):
        assert client.get(API + route, headers=unknown).status_code == 403


@pytest.mark.parametrize("name,action", [("viewer", "ingreso"), ("viewer", "salida"), ("entry", "salida"), ("exit", "ingreso"), ("unknown", "ingreso")])
def test_action_permissions_enforced_directly(client, data, name, action):
    auth = headers(client, name)
    if action == "ingreso":
        result = enter(client, auth, {"patente": "DENIED1", "tipo": "AUTO", "torre_id": data["towers"][0]})
    else:
        result = client.post(API + f"/parking/{data['active'][0]}/salida", headers=command_headers(auth),
                             json={"cotizacion_id": "00000000-0000-0000-0000-000000000001", "caja_id": 1, "metodo_pago": "EFECTIVO"})
    assert result.status_code == 403
    with SessionLocal() as db:
        assert db.query(m.Estadia).count() == 6
        stay = db.get(m.Estadia, data["active"][0])
        assert stay.estado == "ACTIVO" and stay.fecha_salida is None and stay.monto == 0 and stay.usuario_salida_id is None


@pytest.mark.parametrize("other", [1, 2])
def test_foreign_entry_and_checkout_leave_state_unchanged(client, data, other):
    auth = headers(client, "op_a1")
    result = enter(client, auth, {"patente": "DENIED2", "tipo": "AUTO", "torre_id": data["towers"][other]})
    assert result.status_code in (403, 404)
    with SessionLocal() as db:
        stay = db.get(m.Estadia, data["active"][other])
        before = (stay.estado, stay.fecha_entrada, stay.fecha_salida, stay.monto, stay.usuario_salida_id, stay.metodo_pago)
    owner = headers(client, "op_a2" if other == 1 else "op_b1")
    foreign_quote = client.post(API + f"/parking/{data['active'][other]}/cotizaciones", headers=owner)
    assert foreign_quote.status_code == 200
    result = client.post(API + f"/parking/{data['active'][other]}/salida", headers=command_headers(auth),
                         json={"cotizacion_id": foreign_quote.json()["id"], "caja_id": other + 1, "metodo_pago": "EFECTIVO"})
    assert result.status_code in (400, 404)
    with SessionLocal() as db:
        stay = db.get(m.Estadia, data["active"][other])
        assert (stay.estado, stay.fecha_entrada, stay.fecha_salida, stay.monto, stay.usuario_salida_id, stay.metodo_pago) == before
        assert not db.query(m.Vehiculo).filter_by(patente="DENIED2").first()
        assert not db.query(m.Auditoria).count()


def test_scoped_lists_configuration_users_and_branding(client, data):
    auth = headers(client)
    assert [s["id"] for s in client.get(API + "/parking/activas", headers=auth).json()] == [data["active"][0]]
    assert [s["id"] for s in client.get(API + "/parking/historial", headers=auth).json()["items"]] == [data["historic"][0]]
    user_list = client.get(API + "/auth/users", headers=auth).json()
    assert all(u["sucursal_id"] == data["branches"][0] for u in user_list)
    assert client.delete(API + f"/auth/users/{data['users']['admin_a2']}", headers=auth).status_code == 404
    assert client.patch(API + "/parking/config", headers=auth, json={"nombre": "Only A1"}).status_code == 200
    assert client.patch(API + "/parking/config", headers=auth, json={"color_primario": "#abcdef"}).status_code == 403
    with SessionLocal() as db:
        assert db.get(m.Sucursal, data["branches"][1]).nombre == "Alpha Norte"
        assert db.get(m.Sucursal, data["branches"][0]).empresa.color_primario != "#abcdef"


def test_operational_vs_financial_reads_and_cash_management(client, data):
    op = headers(client, "op_a1")
    summary = client.get(API + "/stats/summary", headers=op)
    assert summary.status_code == 200 and summary.json()["autos_adentro"] == 1
    assert "recaudacion_hoy" not in summary.json()
    assert client.get(API + "/parking/config", headers=op).status_code == 200
    assert client.get(API + "/parking/activas", headers=op).status_code == 200
    for path in ["/parking/historial", "/parking/auditoria", "/stats/revenue-hourly", "/cash/history"]:
        assert client.get(API + path, headers=op).status_code == 403
    cash = client.get(API + "/cash/status", headers=op).json()
    assert cash["estado"] == "ABIERTA"
    assert not {"monto_esperado", "monto_real", "diferencia", "notas"}.intersection(cash)
    assert client.post(API + "/cash/abrir", headers=command_headers(op), json={}).status_code == 403
    assert client.post(API + "/cash/1/cerrar", headers=command_headers(op), json={"monto_real": "0.00"}).status_code == 403
    finance = headers(client, "finance")
    assert Decimal(client.get(API + "/stats/summary", headers=finance).json()["recaudacion_hoy"]) == 100
    assert client.get(API + "/stats/revenue-hourly", headers=finance).status_code == 200
    assert client.get(API + "/parking/historial", headers=headers(client, "history")).status_code == 200
    admin = headers(client)
    assert Decimal(client.get(API + "/stats/summary", headers=admin).json()["recaudacion_hoy"]) == 100
    assert client.get(API + "/parking/auditoria", headers=admin).status_code == 200
    assert client.post(API + "/cash/1/cerrar", headers=command_headers(admin), json={"monto_real": "0.00"}).status_code == 200
    assert client.get(API + "/cash/status", headers=admin).status_code == 404
    assert client.post(API + "/cash/abrir", headers=command_headers(admin), json={}).status_code == 200
    with SessionLocal() as db:
        assert db.query(m.CierreCaja).filter_by(sucursal_id=data["branches"][1], estado="ABIERTA").count() == 1


def test_same_plate_independent_branch_type_and_checkout(client, data):
    results = []
    for i, (user, kind) in enumerate([("op_a1", "AUTO"), ("op_a2", "MOTO"), ("op_b1", "CAMIONETA")]):
        response = enter(client, headers(client, user), {
            "patente": "SHARED1", "tipo": kind, "torre_id": data["towers"][i]}, caja_id=i + 1)
        assert response.status_code == 200, response.text
        assert response.json()["tipo_vehiculo"] == kind
        results.append(response.json()["id"])
    duplicate = enter(client, headers(client, "op_a1"), {
        "patente": "SHARED1", "tipo": "MOTO", "torre_id": data["towers"][0]})
    assert duplicate.status_code == 409
    with SessionLocal() as db:
        for stay_id in results:
            db.get(m.Estadia, stay_id).fecha_entrada_utc = datetime.now(timezone.utc) - timedelta(minutes=20)
        db.commit()
    result = checkout(client, headers(client, "op_a2"), results[1], caja_id=2)
    assert result.status_code == 200, result.text
    assert result.json()["id"] == results[1] and Decimal(result.json()["monto"]) == 500
    with SessionLocal() as db:
        assert db.get(m.Estadia, results[0]).estado == "ACTIVO"
        assert db.get(m.Estadia, results[2]).estado == "ACTIVO"
        assert db.get(m.Estadia, results[0]).tipo_vehiculo == "AUTO"


def test_pdf_authenticated_scoped_and_operation_permission(client, data):
    own, sister, foreign = data["historic"]
    assert client.get(API + f"/parking/{own}/pdf").status_code == 401
    viewer = headers(client, "viewer")
    assert client.get(API + f"/parking/{own}/pdf", headers=viewer).status_code == 403
    op = headers(client, "op_a1")
    own_pdf = client.get(API + f"/parking/{own}/pdf", headers=op)
    assert own_pdf.status_code == 200, own_pdf.text[:100]
    assert own_pdf.content.startswith(b"%PDF") and own_pdf.headers["content-type"] == "application/pdf"
    for stay in (sister, foreign, 999999):
        assert client.get(API + f"/parking/{stay}/pdf", headers=op).status_code == 404
    assert client.get(API + f"/parking/{own}/pdf", headers=headers(client, "history")).status_code == 200
    assert client.get(API + f"/parking/{own}/pdf", headers=headers(client, "entry")).status_code == 403
    with SessionLocal() as db:
        db.get(m.Usuario, data["users"]["op_a1"]).permisos = "ingreso"
        db.commit()
    assert client.get(API + f"/parking/{own}/pdf", headers=op).status_code == 403
    assert client.get(API + f"/parking/{data['active'][0]}/pdf", headers=op).status_code == 200


@pytest.mark.parametrize("name,target", [("op_a1", 1), ("op_a1", 2), ("root", 0), ("unknown", 0)])
def test_ws_scope_and_role_rejected(client, data, name, target):
    with client.websocket_connect(f"/ws/{data['branches'][target]}", headers={"Origin": ORIGIN}) as ws:
        ws.send_json({"type": "authenticate", "token": login(client, name)})
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
        assert closed.value.code == 4403


def test_ws_bad_origin_invalid_expired_and_missing_auth(client, data):
    for origin in (None, "https://evil.example"):
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/1", headers={"Origin": origin} if origin else {}):
                pytest.fail("Origin no permitido fue aceptado")
    for token in ("invalid", signed(str(data["users"]["op_a1"]), -1)):
        with client.websocket_connect("/ws/1", headers={"Origin": ORIGIN}) as ws:
            ws.send_json({"type": "authenticate", "token": token})
            with pytest.raises(WebSocketDisconnect) as closed:
                ws.receive_json()
            assert closed.value.code == 4401
    with client.websocket_connect("/ws/1", headers={"Origin": ORIGIN}) as ws:
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
        assert closed.value.code == 4401


def test_ws_expiry_closes_idle_connection(client, data):
    with client.websocket_connect("/ws/1", headers={"Origin": ORIGIN}) as ws:
        authenticate_ws(ws, signed(str(data["users"]["op_a1"]), 2))
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
        assert closed.value.code == 4401


def test_ws_real_events_scope_redaction_and_rejection_no_success(client, data):
    tokens = [login(client, name) for name in ("op_a1", "op_a2", "op_b1")]
    with client.websocket_connect("/ws/1", headers={"Origin": ORIGIN}) as a, \
         client.websocket_connect("/ws/2", headers={"Origin": ORIGIN}) as sister, \
         client.websocket_connect("/ws/3", headers={"Origin": ORIGIN}) as b:
        for ws, token in zip((a, sister, b), tokens):
            authenticate_ws(ws, token)
        auth_a = {"Authorization": "Bearer " + tokens[0]}
        foreign_quote = client.post(API + f"/parking/{data['active'][1]}/cotizaciones", headers={"Authorization": "Bearer " + tokens[1]})
        assert foreign_quote.status_code == 200
        denied = client.post(API + f"/parking/{data['active'][1]}/salida", headers=command_headers(auth_a),
                             json={"cotizacion_id": foreign_quote.json()["id"], "caja_id": 2, "metodo_pago": "EFECTIVO"})
        assert denied.status_code == 404
        assert enter(client, auth_a, {"patente": "NOEVENT", "tipo": "AUTO", "torre_id": 2}).status_code in (403, 404)
        for i, (ws, token) in enumerate(zip((a, sister, b), tokens)):
            result = enter(client, {"Authorization": "Bearer " + token},
                           {"patente": f"EVENT{i}X", "tipo": "AUTO", "torre_id": data["towers"][i]}, caja_id=i + 1)
            assert result.status_code == 200
            assert ws.receive_json() == {"event": "NUEVO_INGRESO", "id": result.json()["id"]}
        result = checkout(client, auth_a, data["active"][0])
        assert result.status_code == 200 and Decimal(result.json()["monto"]) > 0
        assert a.receive_json() == {"event": "NUEVA_SALIDA", "id": result.json()["id"]}


@pytest.mark.parametrize("change", ["delete", "branch", "permissions"])
def test_ws_rechecks_database_on_real_broadcast(client, data, change):
    token = login(client, "viewer")
    with client.websocket_connect("/ws/1", headers={"Origin": ORIGIN}) as ws:
        authenticate_ws(ws, token)
        with SessionLocal() as db:
            user = db.get(m.Usuario, data["users"]["viewer"])
            if change == "delete":
                db.delete(user)
            elif change == "branch":
                user.sucursal_id = data["branches"][1]
            else:
                user.permisos = ""
            db.commit()
        result = enter(client, headers(client), {"patente": "REVOKE1", "tipo": "AUTO", "torre_id": 1})
        assert result.status_code == 200
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
        assert closed.value.code in (4401, 4403)

"""Cortesía pública por estadía contra cotización, API y PostgreSQL reales."""
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.models import db_models as m
from main import app
from scripts.access_test_data import PASSWORD, reset_and_seed

API = "/api/v1"
ENTRY = datetime(2026, 11, 11, 12, tzinfo=timezone.utc)


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
    response = client.post(API + "/auth/login", data={
        "username": f"{name}@sf02a.example.com", "password": PASSWORD,
    })
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def active_stay(client, headers, stay_id):
    response = client.get(API + "/parking/activas", headers=headers)
    assert response.status_code == 200, response.text
    stay = next(item for item in response.json() if item["id"] == stay_id)
    assert not {"reglas_ingreso", "reglas", "tarifa_hora", "porcentaje_descuento"} & stay.keys()
    return stay


@pytest.mark.parametrize("courtesy", [10, 0])
def test_active_indicator_keeps_entry_courtesy_when_config_changes_at_fifteen_minutes(client, data, monkeypatch, courtesy):
    actor, admin = auth(client), auth(client, "admin_a1")
    monkeypatch.setattr(m, "utc_now", lambda: ENTRY)
    configured = client.patch(API + "/parking/config", headers=admin,
                              json={"tiempo_cortesia_min": courtesy, "tarifa_auto": "1000.00"})
    assert configured.status_code == 200, configured.text
    key = str(uuid4())
    body = {"patente": "GRACE01", "torre_id": 1, "tipo": "AUTO", "caja_id": 1}
    entered = client.post(API + "/parking/ingreso", headers={**actor, "Idempotency-Key": key}, json=body)
    assert entered.status_code == 200, entered.text
    stay_id = entered.json()["id"]
    assert entered.json()["cortesia_minutos"] == courtesy
    assert entered.json()["origen_cortesia"] == "INGRESO"
    with SessionLocal() as db:
        original_rules = db.get(m.Estadia, stay_id).reglas_ingreso

    configured = client.patch(API + "/parking/config", headers=admin,
                              json={"tiempo_cortesia_min": 20, "tarifa_auto": "9999.00"})
    assert configured.status_code == 200, configured.text
    cutoff = ENTRY + timedelta(minutes=15)
    monkeypatch.setattr(m, "utc_now", lambda: cutoff)
    # También el operador de ocupación, sin permiso de cotizar, recibe sólo
    # los minutos efectivos y su procedencia para el indicador.
    listed = active_stay(client, auth(client, "viewer"), stay_id)
    assert listed["cortesia_minutos"] == courtesy
    assert listed["origen_cortesia"] == "INGRESO"
    elapsed = (cutoff - datetime.fromisoformat(listed["fecha_entrada"])).total_seconds()
    assert elapsed == 900 and elapsed > listed["cortesia_minutos"] * 60
    quoted = client.post(API + f"/parking/{stay_id}/cotizaciones", headers=actor)
    assert quoted.status_code == 200, quoted.text
    quote = quoted.json()
    assert quote["explicacion"]["segundos_totales"] == "900"
    assert quote["explicacion"]["cortesia_minutos"] == listed["cortesia_minutos"]
    assert quote["origen_reglas"] == listed["origen_cortesia"]
    assert Decimal(quote["monto"]) == Decimal("1000.00")
    replay = client.post(API + "/parking/ingreso", headers={**actor, "Idempotency-Key": key}, json=body)
    assert replay.status_code == 200 and replay.json() == entered.json()
    with SessionLocal() as db:
        assert db.get(m.Estadia, stay_id).reglas_ingreso == original_rules


def test_legacy_indicator_explicitly_uses_current_rules_without_creating_a_snapshot(client, data, monkeypatch):
    actor, admin = auth(client), auth(client, "admin_a1")
    stay_id = data["active"][0]
    with SessionLocal() as db:
        stay = db.get(m.Estadia, stay_id)
        assert stay.reglas_ingreso is None
        stay.fecha_entrada_utc = ENTRY
        db.commit()
    configured = client.patch(API + "/parking/config", headers=admin, json={"tiempo_cortesia_min": 20})
    assert configured.status_code == 200, configured.text
    monkeypatch.setattr(m, "utc_now", lambda: ENTRY + timedelta(minutes=15))
    listed = active_stay(client, actor, stay_id)
    assert listed["cortesia_minutos"] == 20
    assert listed["origen_cortesia"] == "HEREDADO_CONFIG_ACTUAL"
    quoted = client.post(API + f"/parking/{stay_id}/cotizaciones", headers=actor)
    assert quoted.status_code == 200, quoted.text
    assert quoted.json()["origen_reglas"] == listed["origen_cortesia"]
    assert quoted.json()["explicacion"]["cortesia_minutos"] == listed["cortesia_minutos"]
    assert Decimal(quoted.json()["monto"]) == Decimal("0.00")
    with SessionLocal() as db:
        assert db.get(m.Estadia, stay_id).reglas_ingreso is None


@pytest.mark.parametrize("invalid_rules", [
    {"cortesia_minutos": 10},
    {"categoria": "AUTO", "tarifa_hora": "NaN", "porcentaje_descuento": "0",
     "cortesia_minutos": 10, "fraccion_minutos": 15},
    {"categoria": "AUTO", "tarifa_hora": "1000", "porcentaje_descuento": "0",
     "cortesia_minutos": True, "fraccion_minutos": 15},
])
def test_invalid_snapshot_never_inherits_current_courtesy(client, data, invalid_rules):
    actor = auth(client)
    stay_id = data["active"][0]
    with SessionLocal() as db:
        db.get(m.Estadia, stay_id).reglas_ingreso = invalid_rules
        db.get(m.Sucursal, data["branches"][0]).tiempo_cortesia_min = 20
        db.commit()
    listed = active_stay(client, actor, stay_id)
    assert listed["cortesia_minutos"] is None
    assert listed["origen_cortesia"] == "DESCONOCIDO"
    quoted = client.post(API + f"/parking/{stay_id}/cotizaciones", headers=actor)
    assert quoted.status_code == 409
    assert quoted.json()["detail"]["code"] == "SNAPSHOT_INVALIDO"
    with SessionLocal() as db:
        assert db.get(m.Estadia, stay_id).reglas_ingreso == invalid_rules


def test_invalid_legacy_current_rules_keep_courtesy_unknown(client, data):
    actor = auth(client)
    stay_id = data["active"][0]
    with SessionLocal() as db:
        db.get(m.Sucursal, data["branches"][0]).tiempo_cortesia_min = -1
        db.commit()
    listed = active_stay(client, actor, stay_id)
    assert listed["cortesia_minutos"] is None
    assert listed["origen_cortesia"] == "DESCONOCIDO"
    quoted = client.post(API + f"/parking/{stay_id}/cotizaciones", headers=actor)
    assert quoted.status_code == 409
    assert quoted.json()["detail"]["code"] == "CONFIGURACION_INVALIDA"

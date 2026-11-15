"""A displayed count cannot close a different financial state or a later turn."""
from decimal import Decimal
from uuid import uuid4

from app.core.database import SessionLocal
from app.models import db_models as m
from test_release_operations import API, ORIGIN, auth, client, command, confirm, data, quote


def close(client, admin, revision, *, key=None, cash_id=1, counted="0.00"):
    return client.post(API + f"/cash/{cash_id}/cerrar", headers=command(admin, key),
                       json={"monto_real": counted, "revision_cierre": revision})


def test_revision_is_stable_and_not_exposed_to_operational_roles(client):
    admin, actor = auth(client, "admin_a1"), auth(client)
    first = client.get(API + "/cash/status", headers=admin).json()
    again = client.get(API + "/cash/status", headers=admin).json()
    assert len(first["revision_cierre"]) == 64
    assert first["revision_cierre"] == again["revision_cierre"]
    operative = client.get(API + "/cash/status", headers=actor).json()
    assert "revision_cierre" not in operative and "monto_esperado" not in operative


def test_external_charge_invalidates_count_and_rejection_is_durable(client, data):
    admin, actor = auth(client, "admin_a1"), auth(client)
    original = client.get(API + "/cash/status", headers=admin).json()
    stay_id = data["active"][0]
    q = quote(client, actor, stay_id)
    assert confirm(client, actor, stay_id, q).status_code == 200
    changed = client.get(API + "/cash/status", headers=admin).json()
    assert changed["id"] == original["id"]
    assert changed["revision_cierre"] != original["revision_cierre"]
    assert Decimal(changed["monto_esperado"]) == Decimal(q["monto"])
    key = str(uuid4())
    rejected = close(client, admin, original["revision_cierre"], key=key)
    assert rejected.status_code == 409 and rejected.json()["detail"]["code"] == "CAJA_MODIFICADA"
    assert rejected.headers["Idempotency-Resolved"] == "true"
    with SessionLocal() as db:
        assert db.get(m.CierreCaja, 1).estado == "ABIERTA"
        assert db.query(m.Auditoria).filter_by(accion="CIERRE_CAJA").count() == 0
    replay = close(client, admin, original["revision_cierre"], key=key)
    assert replay.status_code == 409 and replay.headers["Idempotency-Replayed"] == "true"
    # Updating the precondition is a new intent, never a mutation of the old key.
    altered = close(client, admin, changed["revision_cierre"], key=key)
    assert altered.status_code == 409 and altered.json()["detail"]["code"] == "CLAVE_REUTILIZADA"
    accepted = close(client, admin, changed["revision_cierre"], counted=changed["monto_esperado"])
    assert accepted.status_code == 200 and Decimal(accepted.json()["diferencia"]) == 0


def test_remote_charge_and_close_emit_invalidations_for_a_counting_terminal(client, data):
    admin, actor = auth(client, "admin_a1"), auth(client)
    with client.websocket_connect("/ws/1", headers={"Origin": ORIGIN}) as terminal:
        terminal.send_json({"type": "authenticate", "token": admin["Authorization"].removeprefix("Bearer ")})
        assert terminal.receive_json() == {"type": "authenticated"}
        before = client.get(API + "/cash/status", headers=admin).json()
        stay_id = data["active"][0]
        assert confirm(client, actor, stay_id, quote(client, actor, stay_id)).status_code == 200
        assert terminal.receive_json() == {"event": "NUEVA_SALIDA", "id": stay_id}
        changed = client.get(API + "/cash/status", headers=admin).json()
        assert changed["revision_cierre"] != before["revision_cierre"]
        assert close(client, admin, changed["revision_cierre"], counted=changed["monto_esperado"]).status_code == 200
        assert terminal.receive_json() == {"event": "CONFIG_UPDATED"}
        assert client.get(API + "/cash/status", headers=admin).status_code == 404


def test_closed_selected_turn_never_becomes_the_new_turn_on_retry(client):
    admin = auth(client, "admin_a1")
    original = client.get(API + "/cash/status", headers=admin).json()
    key = str(uuid4())
    assert close(client, admin, original["revision_cierre"], key=key).status_code == 200
    opened = client.post(API + "/cash/abrir", headers=command(admin), json={"notas": "Turno posterior"})
    assert opened.status_code == 200
    next_id = opened.json()["id"]
    assert next_id != original["id"]
    replay = close(client, admin, original["revision_cierre"], key=key)
    assert replay.status_code == 200 and replay.headers["Idempotency-Replayed"] == "true"
    assert replay.json()["id"] == original["id"]
    late = close(client, admin, original["revision_cierre"])
    assert late.status_code == 409 and late.json()["detail"]["code"] == "CAJA_CERRADA"
    assert client.get(API + "/cash/status", headers=admin).json()["id"] == next_id


def test_revision_does_not_grant_permission_or_cross_branch_access(client):
    admin = auth(client, "admin_a1")
    revision = client.get(API + "/cash/status", headers=admin).json()["revision_cierre"]
    assert close(client, auth(client), revision).status_code == 403
    assert close(client, auth(client, "admin_a2"), revision).status_code == 404


def test_invalid_revision_is_rejected_before_creating_a_close_intent(client):
    result = close(client, auth(client, "admin_a1"), "invalid")
    assert result.status_code == 422
    with SessionLocal() as db:
        assert db.get(m.CierreCaja, 1).estado == "ABIERTA"
        assert db.query(m.OperacionIdempotente).count() == 0

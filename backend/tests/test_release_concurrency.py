"""Concurrencia real: requests/autenticación reales y transacciones PG independientes.

La barrera de filas mantiene ambas requests pendientes en PostgreSQL antes de
liberarlas. Se observan PIDs distintos esperando locks; no se reemplaza auth,
el motor de cobro ni la persistencia. Sólo RELEASE_ALLOW_RESET=1 descartable.
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, text

from app.core.database import SessionLocal
from app.models import db_models as m
from main import app
from scripts.access_test_data import PASSWORD, reset_and_seed

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


def auth(client, name="op_a1"):
    result = client.post(API + "/auth/login", data={"username": f"{name}@sf02a.example.com", "password": PASSWORD})
    assert result.status_code == 200, result.text
    return {"Authorization": "Bearer " + result.json()["access_token"]}


def box_id(data, index=0):
    with SessionLocal() as db:
        return db.query(m.CierreCaja).filter_by(sucursal_id=data["branches"][index], estado="ABIERTA").one().id


def command(path, headers, key, body):
    return {"method": "POST", "url": API + path,
            "headers": {**headers, "Idempotency-Key": key}, "json": body}


def send(client, request):
    result = client.request(**request)
    assert result.status_code < 500, result.text
    return result


def race(requests, branches):
    """Cada worker tiene TestClient y cada request su sesión DB real propia."""
    gate = SessionLocal()
    pool = ThreadPoolExecutor(max_workers=len(requests))
    barrier = Barrier(len(requests) + 1)

    def worker(request):
        with TestClient(app, raise_server_exceptions=False) as independent_client:
            barrier.wait(timeout=10)
            return send(independent_client, request)

    try:
        gate.query(m.Sucursal).filter(m.Sucursal.id.in_(branches)).order_by(m.Sucursal.id).with_for_update().all()
        futures = [pool.submit(worker, request) for request in requests]
        barrier.wait(timeout=10)
        deadline = time.monotonic() + 10
        waiting_pids = set()
        with SessionLocal() as monitor:
            while time.monotonic() < deadline:
                waiting_pids = set(monitor.execute(text("""
                    SELECT pid FROM pg_stat_activity
                    WHERE datname=current_database() AND pid<>pg_backend_pid()
                      AND wait_event_type='Lock' AND state='active'
                """)).scalars())
                monitor.rollback()
                if len(waiting_pids) >= len(requests):
                    break
                time.sleep(0.01)
        assert len(waiting_pids) >= len(requests), "No se observaron requests simultáneas en conexiones PG distintas"
        gate.commit()
        return [future.result(timeout=20) for future in futures]
    finally:
        # Liberar la barrera también si una aserción falla, antes de esperar workers.
        gate.rollback()
        gate.close()
        pool.shutdown(wait=True, cancel_futures=True)


def quote(client, data, headers):
    result = client.post(API + f"/parking/{data['active'][0]}/cotizaciones", headers=headers)
    assert result.status_code == 200, result.text
    return result.json()


def test_last_place_accepts_only_one_real_concurrent_entry(client, data):
    with SessionLocal() as db:
        db.get(m.Torre, data["towers"][0]).capacidad = 2  # Ya existe un activo.
        db.commit()
    headers, cash = auth(client), box_id(data)
    results = race([
        command("/parking/ingreso", headers, f"last-place-{i}",
                {"patente": f"LAST00{i}", "tipo": "AUTO", "torre_id": data["towers"][0], "caja_id": cash})
        for i in (1, 2)
    ], [data["branches"][0]])
    assert sorted(r.status_code for r in results) == [200, 409]
    with SessionLocal() as db:
        assert db.query(m.Estadia).filter_by(torre_id=data["towers"][0], estado="ACTIVO").count() == 2
        assert db.query(m.Vehiculo).filter(m.Vehiculo.patente.in_(["LAST001", "LAST002"])).count() == 1
        assert db.query(m.Auditoria).filter_by(accion="INGRESO_VEHICULO").count() == 1


def test_same_plate_two_sectors_has_only_one_active_stay(client, data):
    with SessionLocal() as db:
        tower = m.Torre(numero=99, capacidad=50, sucursal_id=data["branches"][0], porcentaje_descuento=0)
        db.add(tower)
        db.commit()
        second_sector = tower.id
    headers, cash = auth(client), box_id(data)
    results = race([
        command("/parking/ingreso", headers, f"same-sector-{i}",
                {"patente": "SAME001", "tipo": "AUTO", "torre_id": tower_id, "caja_id": cash})
        for i, tower_id in enumerate([data["towers"][0], second_sector])
    ], [data["branches"][0]])
    assert sorted(r.status_code for r in results) == [200, 409]
    with SessionLocal() as db:
        assert db.query(m.Estadia).join(m.Vehiculo).filter(
            m.Estadia.sucursal_id == data["branches"][0], m.Estadia.estado == "ACTIVO", m.Vehiculo.patente == "SAME001",
        ).count() == 1
        assert db.query(m.Vehiculo).filter_by(patente="SAME001").count() == 1
        assert db.query(m.Auditoria).filter_by(accion="INGRESO_VEHICULO").count() == 1


@pytest.mark.parametrize("other", [1, 2])
def test_global_vehicle_created_concurrently_preserves_branch_category(client, data, other):
    names = ["op_a1", "op_a2", "op_b1"]
    categories = ["AUTO", "MOTO", "CAMIONETA"]
    requests = [command("/parking/ingreso", auth(client, names[index]), f"global-vehicle-{index}",
                        {"patente": "GLOBAL1", "tipo": categories[index], "torre_id": data["towers"][index], "caja_id": box_id(data, index)})
                for index in (0, other)]
    results = race(requests, [data["branches"][0], data["branches"][other]])
    assert [r.status_code for r in results] == [200, 200]
    assert [r.json()["tipo_vehiculo"] for r in results] == [categories[0], categories[other]]
    with SessionLocal() as db:
        assert db.query(m.Vehiculo).filter_by(patente="GLOBAL1").count() == 1
        stays = db.query(m.Estadia).join(m.Vehiculo).filter(m.Vehiculo.patente == "GLOBAL1").all()
        assert len(stays) == 2
        assert {stay.sucursal_id for stay in stays} == {data["branches"][0], data["branches"][other]}
        assert db.query(m.Auditoria).filter_by(accion="INGRESO_VEHICULO").count() == 2


@pytest.mark.parametrize("same_key", [False, True])
def test_two_confirmations_persist_one_charge_and_one_audit(client, data, same_key):
    headers, cash = auth(client), box_id(data)
    price = quote(client, data, headers)
    body = {"cotizacion_id": price["id"], "caja_id": cash, "metodo_pago": "EFECTIVO"}
    results = race([
        command(f"/parking/{data['active'][0]}/salida", headers,
                "checkout-same" if same_key else f"checkout-distinct-{i}", body)
        for i in (1, 2)
    ], [data["branches"][0]])
    assert sorted(r.status_code for r in results) == ([200, 200] if same_key else [200, 409])
    if same_key:
        assert results[0].json() == results[1].json()
        assert {r.headers["Idempotency-Replayed"] for r in results} == {"true", "false"}
    with SessionLocal() as db:
        stay = db.get(m.Estadia, data["active"][0])
        assert stay.estado == "FINALIZADO" and stay.caja_id == cash
        assert stay.monto == Decimal(price["monto"])
        assert db.query(m.Auditoria).filter_by(accion="COBRO_SALIDA").count() == 1
        decisions = db.query(m.OperacionIdempotente).filter_by(tipo="SALIDA").all()
        assert sum("_rechazo_idempotente" not in decision.respuesta for decision in decisions) == 1
        assert len(decisions) == (1 if same_key else 2)


def test_concurrent_openings_create_one_new_shift(client, data):
    admin, original = auth(client, "admin_a1"), box_id(data)
    closed = send(client, command(f"/cash/{original}/cerrar", admin, "initial-close-concurrency", {"monto_real": "0.00", "notas": "Preparación sintética"}))
    assert closed.status_code == 200
    results = race([command("/cash/abrir", admin, f"open-concurrent-{i}", {}) for i in (1, 2)], [data["branches"][0]])
    assert sorted(r.status_code for r in results) == [200, 409]
    with SessionLocal() as db:
        assert db.query(m.CierreCaja).filter_by(sucursal_id=data["branches"][0], estado="ABIERTA").count() == 1
        assert db.query(m.Auditoria).filter_by(accion="APERTURA_CAJA").count() == 1
        decisions = db.query(m.OperacionIdempotente).filter_by(tipo="CAJA_ABRIR").all()
        assert len(decisions) == 2
        assert sum("_rechazo_idempotente" not in decision.respuesta for decision in decisions) == 1


def test_close_competing_with_payment_has_consistent_shift_totals(client, data):
    operator, admin, cash = auth(client), auth(client, "admin_a1"), box_id(data)
    price = quote(client, data, operator)
    results = race([
        command(f"/parking/{data['active'][0]}/salida", operator, "payment-versus-close",
                {"cotizacion_id": price["id"], "caja_id": cash, "metodo_pago": "EFECTIVO"}),
        command(f"/cash/{cash}/cerrar", admin, "close-versus-payment", {"monto_real": "0.00", "notas": "Cierre concurrente sintético"}),
    ], [data["branches"][0]])
    payment, close = results
    assert close.status_code == 200
    assert payment.status_code in (200, 409)
    with SessionLocal() as db:
        cash_row = db.get(m.CierreCaja, cash)
        stay = db.get(m.Estadia, data["active"][0])
        recorded = db.query(func.sum(m.Estadia.monto)).filter_by(caja_id=cash, estado="FINALIZADO").scalar() or Decimal("0.00")
        assert cash_row.estado == "CERRADA"
        assert cash_row.recaudacion_total == recorded == cash_row.monto_esperado
        assert cash_row.diferencia == -recorded
        assert Decimal(close.json()["recaudacion_total"]) == recorded
        if payment.status_code == 200:
            assert stay.estado == "FINALIZADO" and stay.caja_id == cash
            assert stay.monto == Decimal(price["monto"])
        else:
            assert stay.estado == "ACTIVO" and stay.fecha_salida is None and stay.caja_id is None
        assert db.query(m.Auditoria).filter_by(accion="COBRO_SALIDA").count() == (1 if payment.status_code == 200 else 0)
        assert db.query(m.Auditoria).filter_by(accion="CIERRE_CAJA").count() == 1


def test_late_close_retry_preserves_the_following_shift(client, data):
    admin, old_id = auth(client, "admin_a1"), box_id(data)
    request = command(f"/cash/{old_id}/cerrar", admin, "old-shift-close", {"monto_real": "0.00", "notas": "Primer turno"})
    original = send(client, request)
    assert original.status_code == 200
    opened = send(client, command("/cash/abrir", admin, "following-shift-open", {}))
    assert opened.status_code == 200
    replayed = send(client, request)
    assert replayed.status_code == 200 and replayed.json() == original.json()
    assert replayed.headers["Idempotency-Replayed"] == "true"
    with SessionLocal() as db:
        assert db.get(m.CierreCaja, old_id).estado == "CERRADA"
        assert db.get(m.CierreCaja, opened.json()["id"]).estado == "ABIERTA"
        assert db.query(m.CierreCaja).filter_by(sucursal_id=data["branches"][0], estado="ABIERTA").count() == 1
        assert db.query(m.Auditoria).filter_by(accion="CIERRE_CAJA").count() == 1

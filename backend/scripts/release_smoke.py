"""Recorrido HTTP/WS real de release. Preparar access_test_data.py previamente.

Sólo base release descartable. Las dos horas de ingreso se ajustan como dato
sintético antes de cotizar; el importe lo calcula el motor real del servidor.
"""
import asyncio
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import httpx
import websockets

from app.core.database import SessionLocal
from app.models import db_models as m
from scripts.access_test_data import PASSWORD, require_disposable_database

BASE = "http://127.0.0.1:8000/api/v1"
ORIGIN = "http://127.0.0.1:15175"


async def main():
    require_disposable_database()
    async with httpx.AsyncClient(base_url=BASE, trust_env=False, timeout=15) as http:
        async def login(name):
            result = await http.post("/auth/login", data={"username": f"{name}@sf02a.example.com", "password": PASSWORD})
            result.raise_for_status()
            return {"Authorization": "Bearer " + result.json()["access_token"]}

        op, admin, other = await login("op_a1"), await login("admin_a1"), await login("op_a2")

        async def command(path, actor, body, key=None):
            result = await http.post(path, headers={**actor, "Idempotency-Key": key or str(uuid4())}, json=body)
            assert result.status_code == 200, (path, result.status_code, result.text)
            assert result.headers["Idempotency-Resolved"] == "true"
            return result

        assert (await http.get("/parking/config")).status_code == 401
        assert (await http.get("/parking/historial", headers=op)).status_code == 403
        assert "recaudacion_hoy" not in (await http.get("/stats/summary", headers=op)).json()
        closed_initial = await command("/cash/1/cerrar", admin, {"monto_real": "0.00", "notas": "Preparación smoke sintético"})
        assert closed_initial.json()["estado"] == "CERRADA"
        opened = await command("/cash/abrir", admin, {"notas": "Turno smoke real"})
        box = opened.json()["id"]
        configured = await http.patch("/parking/config", headers=admin, json={"tarifa_auto": "1000.00", "tarifa_camioneta": "2000.00", "tiempo_cortesia_min": 10})
        assert configured.status_code == 200

        async with websockets.connect("ws://127.0.0.1:8000/ws/1", origin=ORIGIN) as socket:
            await socket.send(json.dumps({"type": "authenticate", "token": op["Authorization"].removeprefix("Bearer ")}))
            assert json.loads(await socket.recv()) == {"type": "authenticated"}
            stays = []
            for plate, category in [("LIVE100", "AUTO"), ("LIVE200", "CAMIONETA")]:
                entered = await command("/parking/ingreso", op, {"patente": plate, "torre_id": 1, "tipo": category, "caja_id": box})
                stay_id = entered.json()["id"]
                assert json.loads(await socket.recv()) == {"event": "NUEVO_INGRESO", "id": stay_id}
                stays.append(stay_id)
            # Datos de prueba explícitos, no un reloj falso ni otra fórmula.
            with SessionLocal() as db:
                for stay_id in stays:
                    stay = db.get(m.Estadia, stay_id)
                    start = datetime.now(timezone.utc) - timedelta(minutes=20)
                    stay.fecha_entrada_utc = start
                    stay.fecha_entrada = start.replace(tzinfo=None)
                db.commit()
            for stay_id, expected, method in zip(stays, (1000, 2000), ("EFECTIVO", "QR")):
                q = await http.post(f"/parking/{stay_id}/cotizaciones", headers=op)
                assert q.status_code == 200 and Decimal(q.json()["monto"]) == expected
                key = str(uuid4())
                body = {"cotizacion_id": q.json()["id"], "caja_id": box, "metodo_pago": method}
                paid = await command(f"/parking/{stay_id}/salida", op, body, key)
                assert Decimal(paid.json()["monto"]) == expected
                assert json.loads(await socket.recv()) == {"event": "NUEVA_SALIDA", "id": stay_id}
                replay = await command(f"/parking/{stay_id}/salida", op, body, key)
                assert replay.json() == paid.json() and replay.headers["Idempotency-Replayed"] == "true"
                recovered = await http.get(f"/parking/operaciones/SALIDA/{key}", headers=op)
                assert recovered.status_code == 200 and recovered.json() == paid.json()
                await socket.send(json.dumps({"type": "ping"}))
                assert json.loads(await socket.recv()) == {"type": "pong"}, "Un replay duplicó el evento"
            print("OK ingreso/cotización/cobro exacto y replay/recuperación sin cobro ni eventos duplicados")
            status = (await http.get("/cash/status", headers=admin)).json()
            assert Decimal(status["recaudacion_total"]) == 3000 and Decimal(status["monto_esperado"]) == 1000
            key_close = str(uuid4())
            close_body = {"monto_real": "1000.00", "notas": "Efectivo 1000 + QR 2000; datos sintéticos"}
            closed = await command(f"/cash/{box}/cerrar", admin, close_body, key_close)
            assert Decimal(closed.json()["diferencia"]) == 0
            assert Decimal(closed.json()["totales_por_medio"]["QR"]) == 2000
            assert json.loads(await socket.recv()) == {"event": "CONFIG_UPDATED"}
            next_box = await command("/cash/abrir", admin, {"notas": "Siguiente turno smoke"})
            assert json.loads(await socket.recv()) == {"event": "CONFIG_UPDATED"}
            close_replay = await command(f"/cash/{box}/cerrar", admin, close_body, key_close)
            assert close_replay.json() == closed.json()
            assert (await http.get("/cash/status", headers=admin)).json()["id"] == next_box.json()["id"]
            await socket.send(json.dumps({"type": "ping"}))
            assert json.loads(await socket.recv()) == {"type": "pong"}
            print("OK caja mixta: recaudación3000/efectivo1000/diferencia0, cierre viejo no afecta turno nuevo")
        receipts = (await http.get("/parking/comprobantes-propios", headers=op)).json()
        assert set(stays) <= {item["id"] for item in receipts["items"]}
        for stay_id in stays:
            pdf = await http.get(f"/parking/{stay_id}/pdf", headers=op)
            assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
            assert pdf.headers["Cache-Control"] == "no-store"
            assert (await http.get(f"/parking/{stay_id}/pdf", headers=other)).status_code == 404
            assert (await http.get(f"/parking/{stay_id}/pdf")).status_code == 401
        with SessionLocal() as db:
            assert db.query(m.Auditoria).filter_by(accion="COBRO_SALIDA").count() == 2
        print("OK comprobantes propios recuperables, PDFs autorizados y dos auditorías de cobro reales")
    print("APROBADO recorrido release HTTP/Uvicorn/WS/PostgreSQL; no es QA visual.")


if __name__ == "__main__":
    asyncio.run(main())

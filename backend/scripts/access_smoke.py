"""Smoke SF-02A contra Uvicorn, HTTP y WebSocket reales del proyecto descartable.

Preparar antes los fixtures con access_test_data.py. Este script no reinicia datos;
crea y finaliza operaciones sintéticas con un sufijo distinto por ejecución.
"""

import asyncio
import json
import time
from contextlib import AsyncExitStack

import httpx
import websockets
from websockets.exceptions import ConnectionClosed, InvalidStatusCode

from scripts.access_test_data import PASSWORD, require_disposable_database

BASE = "http://127.0.0.1:8000/api/v1"
ORIGIN = "http://127.0.0.1:15174"


async def main():
    require_disposable_database()
    async with httpx.AsyncClient(base_url=BASE, trust_env=False, timeout=10) as http:
        tokens = []
        for name in ("op_a1", "op_a2", "op_b1"):
            result = await http.post("/auth/login", data={"username": f"{name}@sf02a.example.com", "password": PASSWORD})
            result.raise_for_status()
            tokens.append(result.json()["access_token"])
        auth = [{"Authorization": "Bearer " + token} for token in tokens]
        summary = await http.get("/stats/summary", headers=auth[0])
        assert summary.status_code == 200 and "recaudacion_hoy" not in summary.json()
        assert (await http.get("/parking/config")).status_code == 401
        assert (await http.get("/parking/config", headers={"Authorization": "Bearer invalid"})).status_code == 401
        print("OK HTTP real: login, rechazos y summary operativo sin recaudación")

        try:
            async with websockets.connect("ws://127.0.0.1:8000/ws/1", origin="https://evil.example"):
                raise AssertionError("Origin ajeno aceptado")
        except InvalidStatusCode as exc:
            assert exc.status_code == 403
        async with websockets.connect("ws://127.0.0.1:8000/ws/2", origin=ORIGIN) as wrong_branch:
            await wrong_branch.send(json.dumps({"type": "authenticate", "token": tokens[0]}))
            try:
                await wrong_branch.recv()
                raise AssertionError("Canal ajeno recibió datos")
            except ConnectionClosed as exc:
                assert exc.code == 4403
        print("OK WebSocket real: Origin y sucursal ajenos rechazados")

        async with AsyncExitStack() as stack:
            sockets = []
            for branch, token in enumerate(tokens, 1):
                ws = await stack.enter_async_context(websockets.connect(f"ws://127.0.0.1:8000/ws/{branch}", origin=ORIGIN))
                await ws.send(json.dumps({"type": "authenticate", "token": token}))
                assert json.loads(await ws.recv()) == {"type": "authenticated"}
                sockets.append(ws)
            unauthed = await stack.enter_async_context(websockets.connect("ws://127.0.0.1:8000/ws/1", origin=ORIGIN))
            denied = await http.post("/parking/salida", params={"patente": "FIX2ACT"}, headers=auth[0])
            assert denied.status_code in (400, 404)
            suffix = str(time.time_ns())[-5:]
            plates, ids = [], []
            for i, ws in enumerate(sockets):
                plate = f"L{i}{suffix}"
                created = await http.post("/parking/ingreso", headers=auth[i], json={"patente": plate, "tipo": "AUTO", "torre_id": i + 1})
                assert created.status_code == 200, created.text
                stay_id = created.json()["id"]
                assert json.loads(await asyncio.wait_for(ws.recv(), 3)) == {"event": "NUEVO_INGRESO", "id": stay_id}
                plates.append(plate)
                ids.append(stay_id)
            # Each next event in every room belongs to that room: receiving a
            # queued event from another branch fails this assertion as well.
            for i, ws in enumerate(sockets):
                checkout = await http.post("/parking/salida", headers=auth[i], params={"patente": plates[i]})
                assert checkout.status_code == 200 and checkout.json()["id"] == ids[i]
                assert "monto" in checkout.json()
                assert json.loads(await asyncio.wait_for(ws.recv(), 3)) == {"event": "NUEVA_SALIDA", "id": ids[i]}
            try:
                await asyncio.wait_for(unauthed.recv(), 6)
                raise AssertionError("Socket sin autenticar recibió datos")
            except ConnectionClosed as exc:
                assert exc.code == 4401
            print("OK eventos reales: tres salas aisladas, sin montos/patentes y sin evento de operación rechazada")
        pdf = await http.get(f"/parking/{ids[0]}/pdf", headers=auth[0])
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
        assert (await http.get(f"/parking/{ids[0]}/pdf")).status_code == 401
        assert (await http.get(f"/parking/{ids[1]}/pdf", headers=auth[0])).status_code == 404
        print("OK PDF real: descarga propia autenticada, anónimo y ajeno rechazados")
    print("APROBADO smoke HTTP/WS real de SF-02A. No acredita validación visual del navegador.")


if __name__ == "__main__":
    asyncio.run(main())

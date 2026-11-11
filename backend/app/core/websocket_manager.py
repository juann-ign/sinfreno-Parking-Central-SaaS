"""Branch-scoped websocket invalidations; protected data comes from HTTP endpoints."""

import logging
import time
from typing import Dict

from fastapi import HTTPException, WebSocket
from starlette.concurrency import run_in_threadpool

from app.core.websocket_auth import WebSocketPrincipal, revalidate_websocket

logger = logging.getLogger("sinfreno")

EVENTS = frozenset({"NUEVO_INGRESO", "NUEVA_SALIDA", "CONFIG_UPDATED"})


def minimal_event(message: dict):
    event = message.get("event")
    if event not in EVENTS:
        return None
    payload = {"event": event}
    operation_id = message.get("id")
    if (
        event != "CONFIG_UPDATED"
        and isinstance(operation_id, int)
        and not isinstance(operation_id, bool)
        and operation_id > 0
    ):
        payload["id"] = operation_id
    return payload


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Dict[WebSocket, WebSocketPrincipal]] = {}

    async def connect(self, websocket: WebSocket, principal: WebSocketPrincipal):
        """Register before the ACK, so the client's first HTTP action cannot race it."""
        if time.time() >= principal.expires_at:
            raise HTTPException(status_code=401, detail="Credencial vencida")
        self.active_connections.setdefault(principal.sucursal_id, {})[websocket] = principal
        try:
            await websocket.send_json({"type": "authenticated"})
        except BaseException:
            self.disconnect(websocket, principal.sucursal_id)
            raise
        logger.info("WebSocket autorizado en sucursal %s", principal.sucursal_id)

    def disconnect(self, websocket: WebSocket, sucursal_id: int):
        connections = self.active_connections.get(sucursal_id)
        if connections is None:
            return
        connections.pop(websocket, None)
        if not connections:
            self.active_connections.pop(sucursal_id, None)

    async def close(self, websocket: WebSocket, sucursal_id: int, code: int):
        self.disconnect(websocket, sucursal_id)
        try:
            await websocket.close(code=code)
        except (RuntimeError, OSError):
            # A concurrently disconnected peer requires no further cleanup.
            pass

    async def broadcast(self, message: dict, sucursal_id: int):
        payload = minimal_event(message)
        if payload is None:
            return
        for connection, principal in list(self.active_connections.get(sucursal_id, {}).items()):
            try:
                await run_in_threadpool(revalidate_websocket, principal)
                if time.time() >= principal.expires_at:
                    await self.close(connection, sucursal_id, 4401)
                    continue
                await connection.send_json(payload)
            except HTTPException as exc:
                await self.close(connection, sucursal_id, 4401 if exc.status_code == 401 else 4403)
            except Exception:
                # Fail closed. Notification errors must not turn a committed HTTP
                # operation into a failure or expose tokens/exception contents.
                logger.warning("Canal WebSocket cerrado al fallar una notificación")
                await self.close(connection, sucursal_id, 1011)


manager = ConnectionManager()

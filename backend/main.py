import asyncio
import json
import time

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.exceptions import SinfrenoException
from app.api.v1 import parking, auth, stats, cash, superadmin
from app.core.config import settings
from app.core.websocket_manager import manager
from app.core.websocket_auth import authenticate_websocket, revalidate_websocket
from starlette.concurrency import run_in_threadpool

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- RUTAS DE API ---
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(parking.router, prefix=settings.API_V1_STR)
app.include_router(stats.router, prefix=settings.API_V1_STR)
app.include_router(cash.router, prefix=settings.API_V1_STR)
app.include_router(superadmin.router, prefix=settings.API_V1_STR)


# --- PUNTO DE CONEXIÓN WEBSOCKET ---
# Public URL configuration keeps /ws separate from the HTTP API prefix.
WS_AUTH_TIMEOUT_SECONDS = 5
WS_MAX_AUTH_MESSAGE_LENGTH = 16384


async def receive_socket_message(websocket: WebSocket):
    message = await websocket.receive()
    if message["type"] == "websocket.disconnect":
        raise WebSocketDisconnect(message.get("code", 1000))
    text = message.get("text")
    if text is None or len(text) > WS_MAX_AUTH_MESSAGE_LENGTH:
        raise ValueError("Invalid websocket frame")
    return json.loads(text)


@app.websocket("/ws/{sucursal_id}")
async def websocket_endpoint(websocket: WebSocket, sucursal_id: int):
    # CORS middleware does not protect websocket handshakes. Require one explicit,
    # exact allowed Origin, and never accept credentials through a query string.
    origins = websocket.headers.getlist("origin")
    if (
        len(origins) != 1
        or origins[0] in {"null", "*"}
        or origins[0] not in settings.CORS_ORIGINS
        or websocket.scope.get("query_string")
    ):
        await websocket.close(code=4403)
        return

    await websocket.accept()
    principal = None
    try:
        try:
            auth = await asyncio.wait_for(
                receive_socket_message(websocket), timeout=WS_AUTH_TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            await websocket.close(code=4401)
            return
        if (
            not isinstance(auth, dict)
            or auth.get("type") != "authenticate"
            or not isinstance(auth.get("token"), str)
            or not auth["token"]
            or len(auth["token"]) > 8192
            or set(auth) != {"type", "token"}
        ):
            await websocket.close(code=1008)
            return

        principal = await run_in_threadpool(authenticate_websocket, auth["token"], sucursal_id)
        # The durable connection stores only identity, scope and expiry, not its JWT.
        del auth
        await manager.connect(websocket, principal)
        while True:
            remaining = principal.expires_at - time.time()
            if remaining <= 0:
                await manager.close(websocket, sucursal_id, 4401)
                return
            try:
                message = await asyncio.wait_for(receive_socket_message(websocket), timeout=remaining)
            except asyncio.TimeoutError:
                await manager.close(websocket, sucursal_id, 4401)
                return
            await run_in_threadpool(revalidate_websocket, principal)
            if message != {"type": "ping"}:
                await manager.close(websocket, sucursal_id, 1008)
                return
            await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except HTTPException as exc:
        await manager.close(websocket, sucursal_id, 4401 if exc.status_code == 401 else 4403)
    except (ValueError, KeyError, TypeError):
        await manager.close(websocket, sucursal_id, 1008)
    except Exception:
        await manager.close(websocket, sucursal_id, 1011)
    finally:
        manager.disconnect(websocket, sucursal_id)

@app.get("/")
def health_check():
    return {"status": "online", "version": "v1"}

@app.exception_handler(SinfrenoException)
async def sinfreno_exception_handler(request: Request, exc: SinfrenoException):
    return JSONResponse(
        status_code=400,
        content={"error_code": exc.__class__.__name__, "detail": str(exc)},
    )

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.exceptions import SinfrenoException
from app.api.v1 import parking, auth, stats, cash, superadmin
from app.core.config import settings
from app.core.websocket_manager import manager

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
# Debe estar fuera de los prefijos /api/v1 para que coincida con ws://localhost:8000/ws
@app.websocket("/ws/{sucursal_id}")
async def websocket_endpoint(websocket: WebSocket, sucursal_id: int):
    await manager.connect(websocket, sucursal_id)
    try:
        while True:
            # Espera mensajes (mantiene la conexión viva)
            await websocket.receive_text()
    except WebSocketDisconnect:
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
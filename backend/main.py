from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.exceptions import SinfrenoException
from app.api.v1 import parking, auth, stats
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Aquí incluimos los routers de cada módulo
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(parking.router, prefix=settings.API_V1_STR)
app.include_router(stats.router, prefix=settings.API_V1_STR)

@app.get("/")
def health_check():
    return {"status": "online", "version": "v1"}

@app.exception_handler(SinfrenoException)
async def sinfreno_exception_handler(request: Request, exc: SinfrenoException):
    """
    Este es el traductor: toma un error de lógica de negocio
    y lo convierte en una respuesta JSON que el frontend puede leer.
    """
    return JSONResponse(
        status_code=400,
        content={"error_code": exc.__class__.__name__, "detail": str(exc)},
    )
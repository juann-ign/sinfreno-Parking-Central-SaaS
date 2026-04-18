from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import parking, auth
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

@app.get("/")
def health_check():
    return {"status": "online", "version": "v1"}
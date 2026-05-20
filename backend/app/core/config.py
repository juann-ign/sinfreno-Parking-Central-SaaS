from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sinfreno API"
    DATABASE_URL: str
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:5173"]

    APP_TZ: str = "America/Argentina/Buenos_Aires"

# En producción, esto debe ser una cadena aleatoria larga
    SECRET_KEY: str = "CAMBIAME_POR_ALGO_SUPER_SECRETO_Y_LARGO_12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # Una jornada laboral de 8 horas
    
    class Config:
        env_file = ".env"

settings = Settings()
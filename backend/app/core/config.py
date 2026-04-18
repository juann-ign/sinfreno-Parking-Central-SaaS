from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sinfreno API"
    DATABASE_URL: str
    API_V1_STR: str = "/api/v1"
    # CORS_ORIGINS es vital para que el Frontend se pueda comunicar
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"

settings = Settings()
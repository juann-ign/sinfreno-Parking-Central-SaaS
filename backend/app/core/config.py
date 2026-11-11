"""Explicit runtime configuration. Importing never generates a signing secret."""

from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", hide_input_in_errors=True,
    )

    APP_ENV: Literal["development", "test", "production"] = "production"
    PROJECT_NAME: str = "Sinfreno API"
    DATABASE_URL: str = Field(repr=False)
    SECRET_KEY: str = Field(min_length=32, repr=False)
    ALGORITHM: Literal["HS256"] = "HS256"
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: list[str] = Field(default_factory=list)
    APP_TZ: str = "America/Argentina/Buenos_Aires"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 8, ge=1, le=60 * 24)
    TELEGRAM_TOKEN: str = Field(default="", repr=False)
    TELEGRAM_CHAT_ID: str = Field(default="", repr=False)

    @model_validator(mode="after")
    def validate_runtime(self):
        try:
            database = make_url(self.DATABASE_URL)
        except Exception:
            raise ValueError("DATABASE_URL no es una URL de base válida") from None
        if self.APP_ENV == "production":
            if database.get_backend_name() != "postgresql":
                raise ValueError("Producción requiere PostgreSQL")
            examples = ("cambiame", "changeme", "example", "disposable", "do-not-deploy", "demo", "replace")
            if any(marker in self.SECRET_KEY.casefold() for marker in examples) or len(set(self.SECRET_KEY)) < 10:
                raise ValueError("Producción requiere una clave aleatoria propia; no se aceptan claves de ejemplo")
            if not self.CORS_ORIGINS:
                raise ValueError("Producción requiere CORS_ORIGINS explícitos")
        elif not self.CORS_ORIGINS:
            self.CORS_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]

        for origin in self.CORS_ORIGINS:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"} or not parsed.netloc
                or parsed.username or parsed.password or parsed.path
                or parsed.query or parsed.fragment or "*" in origin
                or (self.APP_ENV == "production" and parsed.scheme != "https")
            ):
                raise ValueError("CORS_ORIGINS debe contener orígenes exactos; producción requiere HTTPS")
        if not self.API_V1_STR.startswith("/") or self.API_V1_STR.endswith("/"):
            raise ValueError("API_V1_STR debe ser un prefijo absoluto sin barra final")
        return self


settings = Settings()

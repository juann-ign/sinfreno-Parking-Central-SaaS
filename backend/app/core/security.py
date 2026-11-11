from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt, JWTError
import math
import re
from passlib.context import CryptContext
from app.core.config import settings

# Usamos Argon2, que es el estándar actual recomendado por OWASP
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def create_access_token(subject: Union[str, Any]) -> str:
    """
    Genera un JWT firmado para un usuario.
    El 'subject' suele ser el ID o el email del usuario.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña ingresada coincide con el hash de la DB."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


def decode_access_token(token: str) -> dict:
    """Valida firma, expiración obligatoria y un identificador PostgreSQL válido."""
    payload = jwt.decode(
        token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM],
        options={"require_exp": True, "require_sub": True},
    )
    subject = payload.get("sub")
    expiry = payload.get("exp")
    if (
        not isinstance(subject, str)
        or re.fullmatch(r"[1-9][0-9]{0,9}", subject) is None
        or int(subject) > 2147483647
        or isinstance(expiry, bool)
        or not isinstance(expiry, (int, float))
        or not math.isfinite(expiry)
        or expiry <= datetime.now(timezone.utc).timestamp()
    ):
        raise JWTError("Credencial inválida")
    return payload

def get_password_hash(password: str) -> str:
    """Genera un hash seguro a partir de una contraseña."""
    return pwd_context.hash(password)

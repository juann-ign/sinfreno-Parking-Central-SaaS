"""Authentication shared by the websocket handshake and live authorization checks."""

from dataclasses import dataclass
import time

from fastapi import HTTPException
from jose import JWTError

from app.api.dependencies import authenticate_token, can_operate, require_branch_user
from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models import db_models


@dataclass(frozen=True)
class WebSocketPrincipal:
    user_id: int
    sucursal_id: int
    expires_at: float


def _require_socket_access(user, requested_sucursal_id):
    require_branch_user(user)
    if (
        requested_sucursal_id <= 0
        or user.sucursal_id != requested_sucursal_id
        or not can_operate(user)
    ):
        raise HTTPException(status_code=403, detail="Acceso al canal no permitido")


def authenticate_websocket(token: str, requested_sucursal_id: int) -> WebSocketPrincipal:
    # A short, private DB session: never retain an ORM session for the socket lifetime.
    with SessionLocal() as db:
        user = authenticate_token(token, db)
        _require_socket_access(user, requested_sucursal_id)
        try:
            claims = decode_access_token(token)
        except JWTError:
            raise HTTPException(status_code=401, detail="Credencial no válida") from None
        return WebSocketPrincipal(user.id, user.sucursal_id, float(claims["exp"]))


def revalidate_websocket(principal: WebSocketPrincipal) -> None:
    if time.time() >= principal.expires_at:
        raise HTTPException(status_code=401, detail="Credencial vencida")
    with SessionLocal() as db:
        user = db.query(db_models.Usuario).filter_by(id=principal.user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="Credencial no válida")
        _require_socket_access(user, principal.sucursal_id)
    # Authorization queries may consume the final part of the credential lifetime.
    if time.time() >= principal.expires_at:
        raise HTTPException(status_code=401, detail="Credencial vencida")

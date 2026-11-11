from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.core.access_policy import (
    OPERATIONAL_PERMISSIONS, can_operate, effective_permissions, normalized_role,
)
from app.models import db_models


oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def authenticate_token(token: str, db: Session) -> db_models.Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
    except (JWTError, ValueError, TypeError, OverflowError):
        raise credentials_exception
    user = db.query(db_models.Usuario).filter(
        db_models.Usuario.id == int(payload["sub"])
    ).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme),
) -> db_models.Usuario:
    return authenticate_token(token, db)


get_current_active_user = get_current_user


def require_branch_user(user: db_models.Usuario) -> db_models.Usuario:
    if (
        normalized_role(user) not in {"ADMIN", "OPERADOR"}
        or not user.sucursal_id or user.sucursal is None
        or user.sucursal.empresa is None
    ):
        raise HTTPException(status_code=403, detail="Acceso de sucursal no autorizado")
    return user


def get_current_branch_user(
    user: db_models.Usuario = Depends(get_current_user),
) -> db_models.Usuario:
    return require_branch_user(user)


def get_user_tenant(user: db_models.Usuario = Depends(get_current_branch_user)) -> int:
    return user.sucursal.empresa_id


class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = {role.upper() for role in allowed_roles}

    def __call__(self, current_user: db_models.Usuario = Depends(get_current_user)):
        role = normalized_role(current_user)
        if role not in self.allowed_roles:
            raise HTTPException(status_code=403, detail="Acceso no autorizado")
        if role in {"ADMIN", "OPERADOR"}:
            require_branch_user(current_user)
        return current_user


class PermissionChecker:
    def __init__(self, *permissions: str, any_of: bool = False):
        self.permissions = frozenset(permissions)
        self.any_of = any_of

    def __call__(self, current_user: db_models.Usuario = Depends(get_current_branch_user)):
        granted = effective_permissions(current_user)
        allowed = bool(granted & self.permissions) if self.any_of else self.permissions <= granted
        if not allowed:
            raise HTTPException(status_code=403, detail="Permiso insuficiente")
        return current_user


require_operational_user = PermissionChecker(*OPERATIONAL_PERMISSIONS, any_of=True)
require_local_admin = RoleChecker(["ADMIN"])

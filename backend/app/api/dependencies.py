from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import db_models

# Define dónde debe el cliente buscar el token (en el endpoint /login)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> db_models.Usuario:
    """
    Valida el token JWT, extrae el usuario y verifica que exista en la DB.
    Si el token es inválido o el usuario no existe, lanza una excepción 401.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(db_models.Usuario).filter(db_models.Usuario.id == user_id).first()
    if not user:
        raise credentials_exception
    return user

def get_current_active_user(
    current_user: db_models.Usuario = Depends(get_current_user)
) -> db_models.Usuario:
    """
    Verifica que el usuario no solo tenga un token válido, 
    sino que siga existiendo y esté habilitado.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Usuario no encontrado o inactivo"
        )
    return current_user

def get_user_tenant(
    user: db_models.Usuario = Depends(get_current_active_user)
) -> int:
    """
    Dependency para obtener el ID de la empresa del usuario actual.
    Garantiza el aislamiento de datos (Multi-tenancy).
    """
    if not user.sucursal_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no tiene una sucursal/empresa asignada."
        )
    # Navegamos la relación: Usuario -> Sucursal -> Empresa
    return user.sucursal.empresa_id

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        """
        Al instanciar la clase, definimos qué roles permitimos.
        Ejemplo: RoleChecker(["admin", "superAdmin"])
        """
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: db_models.Usuario = Depends(get_current_active_user)):
        """
        Este método se ejecuta cada vez que alguien llama al endpoint.
        """
        if current_user.rol not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos suficientes para realizar esta acción."
            )
        return current_user
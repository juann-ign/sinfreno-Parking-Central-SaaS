from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api import dependencies
from app.core import security
from app.models import db_models

router = APIRouter(prefix="/auth", tags=["Security"])

@router.post("/login")
def login(
    db: Session = Depends(dependencies.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    Endpoint estándar de OAuth2 para autenticación.
    Verifica email y contraseña, y retorna un Access Token.
    """
    user = db.query(db_models.Usuario).filter(
        db_models.Usuario.email == form_data.username
    ).first()

    # Nota: No decimos si el mail existe o no por seguridad, damos error genérico.
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )

    access_token = security.create_access_token(subject=user.id)
    
    return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_info": {
                "email": user.email,
                "rol": user.rol,
                "permisos": user.permisos.split(","), # Enviamos array al front: ["ingreso", "salida"]
                "sucursal": {
                    "id": user.sucursal_id,
                    "nombre": user.sucursal.nombre,
                    "tarifa_auto": user.sucursal.tarifa_auto,
                    "tarifa_moto": user.sucursal.tarifa_moto,
                    "tarifa_camioneta": user.sucursal.tarifa_camioneta,
                    "tiempo_cortesia_min": user.sucursal.tiempo_cortesia_min,
                    "fraccion_minutos": user.sucursal.fraccion_minutos,
                    "logo": user.sucursal.empresa.logo_url,
                    "color": user.sucursal.empresa.color_primario
                }
            }
        }

@router.post("/discovery")
def discover_tenant(email: str, db: Session = Depends(dependencies.get_db)):
    user = db.query(db_models.Usuario).filter(db_models.Usuario.email == email).first()
    if not user:
        # Retornamos branding genérico de Sinfreno si el usuario no existe
        return {
            "logo": None, 
            "color": "#4f46e5", 
            "empresa": "Sinfreno"
        }
    
    return {
        "logo": user.sucursal.empresa.logo_url,
        "color": user.sucursal.empresa.color_primario,
        "empresa": user.sucursal.empresa.nombre
    }
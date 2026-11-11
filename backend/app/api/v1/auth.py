from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api import dependencies
from app.core import security
from app.models import db_models, schemas
from app.services.audit_service import registrar_evento

router = APIRouter(prefix="/auth", tags=["Security"])


def user_info(user):
    sucursal = user.sucursal
    return {
        "email": user.email,
        "rol": dependencies.normalized_role(user),
        "activo": user.activo,
        "permisos": sorted(dependencies.effective_permissions(user)),
        "sucursal": {
            "id": sucursal.id,
            "nombre": sucursal.nombre,
            "tarifa_auto": str(sucursal.tarifa_auto) if sucursal.tarifa_auto is not None else None,
            "tarifa_moto": str(sucursal.tarifa_moto) if sucursal.tarifa_moto is not None else None,
            "tarifa_camioneta": str(sucursal.tarifa_camioneta) if sucursal.tarifa_camioneta is not None else None,
            "tiempo_cortesia_min": sucursal.tiempo_cortesia_min,
            "fraccion_minutos": sucursal.fraccion_minutos,
            "logo": sucursal.empresa.logo_url,
            "color": sucursal.empresa.color_primario,
        } if sucursal and sucursal.empresa else None,
    }


@router.get("/me")
def read_current_user(current_user: db_models.Usuario = Depends(dependencies.get_current_user)):
    return user_info(current_user)

@router.post("/login")
def login(
    db: Session = Depends(dependencies.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    user = db.query(db_models.Usuario).filter(
        db_models.Usuario.email == form_data.username
    ).first()

    if not user or not user.activo or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )

    access_token = security.create_access_token(subject=user.id)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_info": user_info(user),
    }
@router.post("/discovery")
def discover_tenant(email: str, db: Session = Depends(dependencies.get_db)):
    user = db.query(db_models.Usuario).filter(db_models.Usuario.email == email).first()
    
    # Si el usuario no existe O no tiene sucursal (es SuperAdmin)
    if not user or not user.activo or not user.sucursal:
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

@router.get("/users", response_model=list[schemas.UsuarioOut])
def list_users(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.require_local_admin)
):
    # AISLAMIENTO: Solo devolvemos usuarios de la misma sucursal
    return db.query(db_models.Usuario).filter(
        db_models.Usuario.sucursal_id == current_user.sucursal_id
    ).all()

@router.post("/users", response_model=schemas.UsuarioOut)
def create_staff_user(
    user_in: schemas.UserCreateInternal,
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.require_local_admin)
):
    # Verificar si el email ya existe
    existing_user = db.query(db_models.Usuario).filter(db_models.Usuario.email == user_in.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # Crear nuevo usuario heredando la sucursal del Admin que lo crea
    new_user = db_models.Usuario(
        email=user_in.email,
        password_hash=security.get_password_hash(user_in.password),
        rol=user_in.rol,
        permisos=",".join(sorted(dependencies.effective_permissions(
            db_models.Usuario(rol=user_in.rol, permisos=",".join(user_in.permisos))
        ))),
        sucursal_id=current_user.sucursal_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.require_local_admin)
):
    user = db.query(db_models.Usuario).filter(
        db_models.Usuario.id == user_id,
        db_models.Usuario.sucursal_id == current_user.sucursal_id # SEGURIDAD
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    if dependencies.normalized_role(user) not in {"ADMIN", "OPERADOR"}:
        raise HTTPException(status_code=403, detail="No puedes administrar una cuenta global")

    if not user.activo:
        return {"detail": "Usuario desactivado", "id": user.id, "activo": False}
    user.activo = False
    registrar_evento(
        db, usuario_id=current_user.id, sucursal_id=current_user.sucursal_id,
        accion="DESACTIVAR_USUARIO", detalles=f"Usuario ID {user.id} desactivado; identidad e historial conservados",
    )
    db.commit()
    return {"detail": "Usuario desactivado", "id": user.id, "activo": False}

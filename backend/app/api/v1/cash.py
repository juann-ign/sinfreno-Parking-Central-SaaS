from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dependencies
from app.models import schemas, db_models
from app.services import caja_service 

router = APIRouter(prefix="/cash", tags=["Cash Management"])

@router.get("/status", response_model=schemas.CierreCajaOut)
def get_status(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    """Retorna la caja abierta actual o 404 si no hay ninguna."""
    # Usamos la función del service que definimos antes
    caja = caja_service.obtener_caja_actual(db, current_user.sucursal_id)
    if not caja:
        raise HTTPException(status_code=404, detail="No hay caja abierta")
    return caja

@router.post("/abrir", response_model=schemas.CierreCajaOut)
def abrir(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    return caja_service.abrir_caja(db, current_user.sucursal_id, current_user.id)

@router.post("/cerrar", response_model=schemas.CierreCajaOut)
def cerrar(
    data: schemas.CierreCajaFinalizar,
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    return caja_service.cerrar_caja(
        db, 
        current_user.sucursal_id, 
        data.monto_real, 
        data.notas
    )
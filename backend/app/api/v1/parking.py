from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import dependencies
from app.models import schemas, db_models
from app.services import parking_service

router = APIRouter(prefix="/parking", tags=["Parking Operations"])

@router.post("/ingreso", response_model=schemas.EstadiaOut)
def ingreso(data: schemas.EstadiaCreate, db: Session = Depends(dependencies.get_db),
    # El usuario viene del token y se inyecta automáticamente gracias a Depends
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    # Usamos current_user.id extraído del JWT
    return parking_service.registrar_ingreso_vehiculo(db, data.patente, data.torre_id, current_user.id)
    

@router.post("/salida", response_model=schemas.EstadiaOut)
def salida(patente: str, db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
    ):
    return parking_service.registrar_salida_vehiculo(db, patente, current_user.id)

@router.get("/activas", response_model=list[schemas.EstadiaOut])
def listar_activas(db: Session = Depends(dependencies.get_db)):
    return parking_service.obtener_estadias_activas(db)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dependencies
from app.models import schemas
from app.services import parking_service

router = APIRouter(prefix="/parking", tags=["Parking Operations"])

@router.post("/ingreso", response_model=schemas.EstadiaOut)
def ingreso(data: schemas.EstadiaCreate, db: Session = Depends(dependencies.get_db)):
    
    return parking_service.registrar_ingreso_vehiculo(db, data.patente, data.torre_id, data.usuario_ingreso_id)
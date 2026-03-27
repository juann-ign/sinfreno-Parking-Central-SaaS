from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import dependencies
from app.models import schemas
from app.services import parking_service

router = APIRouter(prefix="/parking", tags=["Parking Operations"])

@router.post("/ingreso", response_model=schemas.EstadiaResponse)
def ingreso(data: schemas.IngresoVehiculo, db: Session = Depends(dependencies.get_db)):
    try:
        return parking_service.registrar_ingreso_vehiculo(db, data.patente, data.torre_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
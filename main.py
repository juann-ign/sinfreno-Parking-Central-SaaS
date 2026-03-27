from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
import models, schemas, database

app = FastAPI(title="ParkingCentral API")

# Crea las tablas al iniciar (Solo para desarrollo inicial)
models.Base.metadata.create_all(bind=database.engine)

@app.get("/")
def home():
    return {"message": "ParkingCentral API v1 funcionando"}

@app.post("/ingreso", response_model=schemas.EstadiaResponse)
def registrar_ingreso(data: schemas.IngresoVehiculo, db: Session = Depends(database.get_db)):
    # 1. Verificar si la torre existe
    torre = db.query(models.Torre).filter(models.Torre.id == data.torre_id).first()
    if not torre:
        raise HTTPException(status_code=404, detail="La torre no existe")

    # 2. Buscar si el vehículo ya existe en la DB, si no, crearlo
    vehiculo = db.query(models.Vehiculo).filter(models.Vehiculo.patente == data.patente.upper()).first()
    if not vehiculo:
        vehiculo = models.Vehiculo(patente=data.patente.upper())
        db.add(vehiculo)
        db.commit()
        db.refresh(vehiculo)

    # 3. Verificar si ya tiene una estadía activa (no puede entrar dos veces)
    estadia_activa = db.query(models.Estadia).filter(
        models.Estadia.vehiculo_id == vehiculo.id, 
        models.Estadia.estado == "ACTIVO"
    ).first()
    if estadia_activa:
        raise HTTPException(status_code=400, detail="El vehículo ya está dentro del estacionamiento")

    # 4. Crear la nueva estadía
    nueva_estadia = models.Estadia(
        vehiculo_id=vehiculo.id,
        torre_id=data.torre_id
    )
    db.add(nueva_estadia)
    db.commit()
    db.refresh(nueva_estadia)
    
    return nueva_estadia
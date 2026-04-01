from sqlalchemy.orm import Session
from app.models import db_models
from fastapi import HTTPException 
import datetime

def registrar_ingreso_vehiculo(db: Session, patente: str, torre_id: int, usuario_ingreso_id: int):
    # Lógica de ingreso (buscar vehiculo, validar torre, crear estadia)
    
    # 1. Validación crítica: ¿Existe la torre?
    torre = db.query(db_models.Torre).filter(db_models.Torre.id == torre_id).first()
    if not torre:
        raise HTTPException(status_code=404, detail=f"Torre con ID {torre_id} no existe en la base de datos.")
    
    patente_up = patente.upper()
    
    # 2. Buscar o crear vehículo
    vehiculo = db.query(db_models.Vehiculo).filter(db_models.Vehiculo.patente == patente_up).first()
    if not vehiculo:
        vehiculo = db_models.Vehiculo(patente=patente_up)
        db.add(vehiculo)
        db.commit()
        db.refresh(vehiculo)

    # 3. Verificar si el vehículo ya tiene una estadía activa 
    estadia_activa = db.query(db_models.Estadia).filter(db_models.Estadia.vehiculo_id == vehiculo.id, db_models.Estadia.estado == "ACTIVO").first()
    if estadia_activa:
        raise HTTPException(status_code=400, detail="El vehículo ya se encuentra en el estacionamiento.")


    nueva_estadia = db_models.Estadia(vehiculo_id=vehiculo.id, torre_id=torre_id, usuario_ingreso_id=usuario_ingreso_id, fecha_entrada=datetime.datetime.now(), monto=0.0, estado="abierta")
    db.add(nueva_estadia)
    db.commit()
    db.refresh(nueva_estadia)
    return nueva_estadia

def calcular_salida(db: Session, estadia_id: int):
    # Aquí irá la lógica de cálculo de monto, descuentos de torre 3, etc.
    # La desarrollaremos en la siguiente fase.
    pass
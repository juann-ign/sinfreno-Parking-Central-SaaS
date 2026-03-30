from sqlalchemy.orm import Session
from app.models import db_models
import datetime

def registrar_ingreso_vehiculo(db: Session, patente: str, torre_id: int, usuario_ingreso_id: int):
    # Lógica de ingreso (buscar vehiculo, validar torre, crear estadia)
    # Trasladamos lo que estaba en main.py a este servicio
    patente_up = patente.upper()
    
    vehiculo = db.query(db_models.Vehiculo).filter(db_models.Vehiculo.patente == patente_up).first()
    if not vehiculo:
        vehiculo = db_models.Vehiculo(patente=patente_up)
        db.add(vehiculo)
        db.commit()
        db.refresh(vehiculo)

    nueva_estadia = db_models.Estadia(vehiculo_id=vehiculo.id, torre_id=torre_id, usuario_ingreso_id=usuario_ingreso_id, fecha_entrada=datetime.datetime.now(), monto=0.0, estado="abierta")
    db.add(nueva_estadia)
    db.commit()
    db.refresh(nueva_estadia)
    return nueva_estadia

def calcular_salida(db: Session, estadia_id: int):
    # Aquí irá la lógica de cálculo de monto, descuentos de torre 3, etc.
    # La desarrollaremos en la siguiente fase.
    pass
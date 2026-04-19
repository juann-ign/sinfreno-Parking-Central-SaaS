from sqlalchemy.orm import Session
from app.models import db_models
from fastapi import HTTPException 
from datetime import datetime, timezone
from math import ceil
from app.core.websocket_manager import manager # Importar arriba


def registrar_ingreso_vehiculo(db: Session, patente: str, torre_id: int, usuario_ingreso_id: int):
    # 1. Validar Torre
    torre = db.query(db_models.Torre).filter(db_models.Torre.id == torre_id).first()
    if not torre:
        raise HTTPException(status_code=404, detail="Torre no encontrada.")
    
    patente_up = patente.upper().strip()
    
    # 2. Obtener o crear vehículo
    vehiculo = db.query(db_models.Vehiculo).filter(db_models.Vehiculo.patente == patente_up).first()
    if not vehiculo:
        vehiculo = db_models.Vehiculo(patente=patente_up)
        db.add(vehiculo)
        db.commit()
        db.refresh(vehiculo)

    # 3. Validar si ya está adentro
    estadia_activa = db.query(db_models.Estadia).filter(
        db_models.Estadia.vehiculo_id == vehiculo.id, 
        db_models.Estadia.estado == "ACTIVO"
    ).first()
    
    if estadia_activa:
        raise HTTPException(status_code=400, detail="El vehículo ya está en el sistema.")

    # 4. Crear estadía con UTC
    nueva_estadia = db_models.Estadia(
        vehiculo_id=vehiculo.id, 
        torre_id=torre_id, 
        usuario_ingreso_id=usuario_ingreso_id, 
        fecha_entrada=datetime.now(timezone.utc), # Siempre UTC
        monto=0.0, 
        estado="ACTIVO"
    )
    db.add(nueva_estadia)
    db.commit()
    db.refresh(nueva_estadia)
    return nueva_estadia

def registrar_salida_vehiculo(db: Session, patente: str, usuario_egreso_id: int):
    # 1. Buscar estadía activa usando un JOIN (más eficiente)
    estadia = db.query(db_models.Estadia).join(db_models.Vehiculo).filter(
        db_models.Vehiculo.patente == patente.upper().strip(),
        db_models.Estadia.estado == "ACTIVO"
    ).first()

    if not estadia:
        raise HTTPException(status_code=404, detail="No hay una estadía activa para esta patente.")

    # 2. Cálculos de tiempo y dinero
    fecha_salida = datetime.now(timezone.utc)
    # Aseguramos que ambas fechas tengan el mismo 'vibe' (offset-aware)
    entrada_tz = estadia.fecha_entrada.replace(tzinfo=timezone.utc)
    duracion = fecha_salida - entrada_tz
    horas_a_cobrar = ceil(duracion.total_seconds() / 3600)
    if horas_a_cobrar <= 0: horas_a_cobrar = 1

    tarifa = estadia.torre.sucursal.tarifa_hora
    monto_final = horas_a_cobrar * tarifa

    if estadia.torre.aplica_descuento:
        monto_final *= 0.85

    # 3. Actualizar registro
    estadia.fecha_salida = fecha_salida
    estadia.monto = round(monto_final, 2)
    estadia.usuario_salida_id = usuario_egreso_id
    estadia.estado = "FINALIZADO"

    db.commit()
    db.refresh(estadia)
    return estadia

def obtener_estadias_activas(db: Session, sucursal_id: int):
    """
    Retorna solo las estadías activas de la sucursal a la que 
    pertenece el usuario actual.
    """
    return db.query(db_models.Estadia).join(db_models.Torre).filter(
        db_models.Estadia.estado == "ACTIVO",
        db_models.Torre.sucursal_id == sucursal_id
    ).all()
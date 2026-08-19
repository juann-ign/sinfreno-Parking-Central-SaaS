from sqlalchemy.orm import Session
from app.models import db_models
from fastapi import HTTPException 
from app.core.timezone_utils import get_now_local
from sqlalchemy import func


def obtener_caja_actual(db: Session, sucursal_id: int):
    return db.query(db_models.CierreCaja).filter(
        db_models.CierreCaja.sucursal_id == sucursal_id,
        db_models.CierreCaja.estado == "ABIERTA"
    ).first()

def abrir_caja(db: Session, sucursal_id: int, usuario_id: int):
    # Verificar si ya hay una abierta
    caja_existente = obtener_caja_actual(db, sucursal_id)
    if caja_existente:
        return caja_existente
    
    nueva_caja = db_models.CierreCaja(
        sucursal_id=sucursal_id,
        usuario_id=usuario_id,
        estado="ABIERTA"
    )
    db.add(nueva_caja)
    db.commit()
    db.refresh(nueva_caja)
    return nueva_caja

def cerrar_caja(db: Session, sucursal_id: int, monto_real: float, notas: str):
    caja = obtener_caja_actual(db, sucursal_id)
    if not caja:
        raise HTTPException(status_code=404, detail="No hay una caja abierta para cerrar")

    # Calculamos todo lo recaudado entre apertura y ahora
    recaudado = db.query(func.sum(db_models.Estadia.monto)).join(db_models.Torre).filter(
        db_models.Torre.sucursal_id == sucursal_id,
        db_models.Estadia.estado == "FINALIZADO",
        db_models.Estadia.fecha_salida >= caja.fecha_apertura
    ).scalar() or 0.0

    caja.fecha_cierre = get_now_local()
    caja.monto_esperado = recaudado
    caja.monto_real = monto_real
    caja.diferencia = monto_real - recaudado
    caja.estado = "CERRADA"
    caja.notas = notas

    db.commit()
    db.refresh(caja)
    return caja
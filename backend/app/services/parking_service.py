from sqlalchemy.orm import Session, joinedload
from app.models import db_models
from fastapi import HTTPException 
from datetime import datetime, timezone
from math import ceil
from app.core.websocket_manager import manager
from app.core.exceptions import VehiculoYaPresenteError, EstadiaNoEncontradaError
from app.core.logger import logger 

def registrar_ingreso_vehiculo(db: Session, patente: str, torre_id: int, usuario_ingreso_id: int, sucursal_id_usuario: int, tipo: str = "AUTO"):
    # 1. Validar Torre y su capacidad
    # 1. VALIDACIÓN DE SEGURIDAD: ¿Esta torre es de MI sucursal?
    torre = db.query(db_models.Torre).filter(
        db_models.Torre.id == torre_id,
        db_models.Torre.sucursal_id == sucursal_id_usuario # <--- OBLIGATORIO
    ).first()
    
    if not torre:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta torre o no existe.")
    
    # Contar cuántos vehículos están actualmente en esa torre
    ocupacion_actual = db.query(db_models.Estadia).filter(
        db_models.Estadia.torre_id == torre_id,
        db_models.Estadia.estado == "ACTIVO"
    ).count()

    if ocupacion_actual >= torre.capacidad:
        raise HTTPException(status_code=400, detail="Torre llena. No se pueden registrar más ingresos.")

    patente_up = patente.upper().strip()
    
    # 2. Obtener o crear vehículo
    vehiculo = db.query(db_models.Vehiculo).filter(db_models.Vehiculo.patente == patente_up).first()
    if not vehiculo:
        vehiculo = db_models.Vehiculo(patente=patente_up, tipo=tipo)
        db.add(vehiculo)
        db.commit()
        db.refresh(vehiculo)

    # 3. Validar si ya está adentro
    estadia_activa = db.query(db_models.Estadia).filter(
        db_models.Estadia.vehiculo_id == vehiculo.id, 
        db_models.Estadia.estado == "ACTIVO"
    ).first()
    
    if estadia_activa:
        raise VehiculoYaPresenteError(patente_up)

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
    
    logger.info(f"INGRESO: Vehículo {patente_up} en Torre {torre_id} por Usuario ID {usuario_ingreso_id}")

    return nueva_estadia


def registrar_salida_vehiculo(db: Session, patente: str, usuario_egreso_id: int):
    # 1. Buscar estadía activa
    estadia = db.query(db_models.Estadia).join(db_models.Vehiculo).filter(
        db_models.Vehiculo.patente == patente.upper().strip(),
        db_models.Estadia.estado == "ACTIVO",
    ).first()

    if not estadia:
        raise EstadiaNoEncontradaError(patente)

    # 2. Cálculos de Tiempo
    fecha_salida = datetime.now(timezone.utc)
    entrada_tz = estadia.fecha_entrada.replace(tzinfo=timezone.utc)
    duracion = fecha_salida - entrada_tz
    segundos_totales = duracion.total_seconds()
    minutos_totales = segundos_totales / 60

    # 3. Reglas de Negocio
    sucursal = estadia.torre.sucursal
    tarifa_base = sucursal.tarifa_hora
    minutos_gracia = sucursal.tiempo_cortesia_min

    monto_final = 0.0

    # Lógica de Cobro por Fracciones
    if minutos_totales > minutos_gracia:
        if minutos_totales <= 60:
            # Primera hora completa
            monto_final = tarifa_base
        else:
            # Primera hora + fracciones de 15 min
            minutos_adicionales = minutos_totales - 60
            # ceil(minutos / 15) nos da cuántos bloques de 15 min hay
            fracciones_15 = ceil(minutos_adicionales / 15)
            monto_final = tarifa_base + (fracciones_15 * (tarifa_base / 4))

    # 4. Multiplicador por Tipo de Vehículo
    multiplicadores = {"AUTO": 1.0, "MOTO": 0.5, "CAMIONETA": 1.5}
    factor_tipo = multiplicadores.get(estadia.vehiculo.tipo, 1.0)
    monto_final *= factor_tipo

    # 5. Descuento de la Torre
    porcentaje_dto = estadia.torre.porcentaje_descuento or 0.0
    monto_final = monto_final * (1 - porcentaje_dto)

    # 6. Actualización en DB
    estadia.fecha_salida = fecha_salida
    estadia.monto = round(monto_final, 2)
    estadia.usuario_salida_id = usuario_egreso_id
    estadia.estado = "FINALIZADO"

    db.commit()
    db.refresh(estadia)
    
    logger.info(f"SALIDA PRO: {patente} | Duración: {int(minutos_totales)}min | Monto: ${estadia.monto}")
    return estadia

def obtener_estadias_activas(db: Session, sucursal_id: int):
    """
    Retorna solo las estadías activas de la sucursal a la que 
    pertenece el usuario actual.
    """
    return db.query(db_models.Estadia)\
        .options(joinedload(db_models.Estadia.vehiculo))\
        .join(db_models.Torre)\
        .filter(
            db_models.Estadia.estado == "ACTIVO",
            db_models.Torre.sucursal_id == sucursal_id
    ).order_by(db_models.Estadia.fecha_entrada.desc()).all()

def obtener_historial_paginado(db: Session, sucursal_id: int, page: int = 1, size: int = 20, patente: str = None):
    query = db.query(db_models.Estadia).join(db_models.Torre).join(db_models.Vehiculo).filter(
        db_models.Torre.sucursal_id == sucursal_id,
        db_models.Estadia.estado == "FINALIZADO"
    ).order_by(db_models.Estadia.fecha_salida.desc())

    if patente and patente.strip() != "":
        query = query.filter(db_models.Vehiculo.patente.ilike(f"%{patente}%"))

    
    total = query.count()
    # Lógica de paginación: (página - 1) * tamaño
    offset = (page - 1) * size
    items = query.order_by(db_models.Estadia.fecha_salida.desc()).offset(offset).limit(size).all()
    
    import math
    return {
        "total": total,
        "page": page,
        "pages": math.ceil(total / size) if total > 0 else 1,
        "items": items
    }
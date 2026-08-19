from sqlalchemy.orm import Session, joinedload
from app.models import db_models
from fastapi import HTTPException 
from datetime import datetime, timezone
from math import ceil
from app.core.websocket_manager import manager
from app.core.exceptions import VehiculoYaPresenteError, EstadiaNoEncontradaError
from app.core.logger import logger 
from app.services.audit_service import registrar_evento

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

    registrar_evento(
        db, 
        usuario_id=usuario_ingreso_id, 
        sucursal_id=sucursal_id_usuario,
        accion="INGRESO_VEHICULO",
        detalles=f"Vehículo {patente_up} ingresó a Torre {torre_id}"
    )
    
    logger.info(f"INGRESO: Vehículo {patente_up} en Torre {torre_id} por Usuario ID {usuario_ingreso_id}")

    db.commit()
    db.refresh(nueva_estadia)
    return nueva_estadia


def registrar_salida_vehiculo(db: Session, patente: str, usuario_egreso_id: int):
    # 1. Buscar estadía activa
    estadia = db.query(db_models.Estadia).join(db_models.Vehiculo).filter(
        db_models.Vehiculo.patente == patente.upper().strip(),
        db_models.Estadia.estado == "ACTIVO",
    ).first()

    if not estadia:
        raise EstadiaNoEncontradaError(patente)

   # 2. Cálculos de tiempo en UTC
    fecha_salida = datetime.now(timezone.utc)
    duracion = fecha_salida - estadia.fecha_entrada.replace(tzinfo=timezone.utc)
    minutos_totales = ceil(duracion.total_seconds() / 60)

    # 3. Reglas de Negocio
    sucursal = estadia.torre.sucursal
    tipo = estadia.vehiculo.tipo.upper()

    # Selección de tarifa dinámica según tipo de vehículo
    if tipo == "MOTO":
        tarifa_hora = sucursal.tarifa_moto
    elif tipo == "CAMIONETA":
        tarifa_hora = sucursal.tarifa_camioneta
    else:
        tarifa_hora = sucursal.tarifa_auto

    # 4. LÓGICA DEL MOTOR DE COBRO (Empresarial)
    monto_final = 0.0

    # Lógica de Cobro por Fracciones
    if minutos_totales <= sucursal.tiempo_cortesia_min:
        monto_final = 0.0
    elif minutos_totales <= 60:
         # Se cobra la primera hora completa después de la cortesía
        monto_final = tarifa_hora
    else:
        # Primera hora + fracciones
        minutos_adicionales = minutos_totales - 60
        # Calculamos cuántos bloques de (ej: 15 min) hay
        cantidad_fracciones = ceil(minutos_adicionales / sucursal.fraccion_minutos)
        
        # Precio por cada fracción (proporcional a la hora)
        precio_fraccion = (tarifa_hora / 60) * sucursal.fraccion_minutos
        
        monto_final = tarifa_hora + (cantidad_fracciones * precio_fraccion)

    # 5. Aplicar descuento de torre si existe (ej: convenio con hotel)
    if estadia.torre.porcentaje_descuento > 0:
        monto_final -= (monto_final * estadia.torre.porcentaje_descuento)

    # 6. Persistencia
    estadia.fecha_salida = fecha_salida
    estadia.monto = round(monto_final, 2)
    estadia.usuario_salida_id = usuario_egreso_id
    estadia.estado = "FINALIZADO"

    db.commit()
    db.refresh(estadia)

    # 7. Log de auditoría
    registrar_evento(
        db,
        usuario_id=usuario_egreso_id,
        sucursal_id=estadia.torre.sucursal_id,
        accion="COBRO_SALIDA",
        detalles=f"Vehículo {patente} salió. Cobrado: ${estadia.monto}"
    )
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

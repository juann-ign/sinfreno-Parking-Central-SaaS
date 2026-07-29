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
    # 1. Buscar estadía activa usando un JOIN (más eficiente)
    estadia = db.query(db_models.Estadia).join(db_models.Vehiculo).filter(
        db_models.Vehiculo.patente == patente.upper().strip(),
        db_models.Estadia.estado == "ACTIVO",
    ).first()

    if not estadia:
        raise EstadiaNoEncontradaError(patente)

     # 2.1 Obtenemos la sucursal y su tiempo de gracia configurado
    sucursal = estadia.torre.sucursal
    minutos_gracia = sucursal.tiempo_cortesia_min

    # 2.2 Convertimos minutos a segundos para comparar
    segundos_gracia = minutos_gracia * 60

    # 2.3 Calculamos la duración real
    fecha_salida = datetime.now(timezone.utc)
    # Aseguramos que ambas fechas tengan el mismo 'vibe' (offset-aware)
    entrada_tz = estadia.fecha_entrada.replace(tzinfo=timezone.utc)
    duracion = fecha_salida - entrada_tz
    segundos_totales = duracion.total_seconds()

    # 2.4 Lógica de cobro dinámica
    if segundos_totales < segundos_gracia: 
        monto_final = 0.0
    else:
        horas_a_cobrar = ceil(segundos_totales / 3600)
        tarifa_base = estadia.torre.sucursal.tarifa_hora

        # Multiplicador por tipo de vehículo (Lógica simple para este ejemplo)
        multiplicadores = {"AUTO": 1.0, "MOTO": 0.5, "CAMIONETA": 1.5}
        factor_tipo = multiplicadores.get(estadia.vehiculo.tipo, 1.0)
        monto_bruto = horas_a_cobrar * tarifa_base * factor_tipo

        porcentaje = estadia.torre.porcentaje_descuento if estadia.torre.porcentaje_descuento is not None else 0.0

        # Aplicar descuento dinámico de la torre
        descuento = monto_bruto * porcentaje
        monto_final = monto_bruto - descuento

    # 3. Actualizar registro
    estadia.fecha_salida = fecha_salida
    estadia.monto = round(monto_final, 2)
    estadia.usuario_salida_id = usuario_egreso_id
    estadia.estado = "FINALIZADO"

    logger.info(f"SALIDA: Vehículo {patente} egresó por Torre {estadia.torre_id} por Usuario ID {usuario_egreso_id}")
    
    db.commit()
    db.refresh(estadia)
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
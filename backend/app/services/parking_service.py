import math
from datetime import timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import joinedload

from app.models import db_models as m, schemas
from app.services.audit_service import registrar_evento
from app.services.billing import CATEGORIES, calcular_cobro, validate_rules
from app.services.caja_service import exigir_caja_abierta
from app.services.receipt_details import duracion_estadia
from app.services.idempotency import begin_operation, lock_branch, operation_error, save_operation, rollback_or_record_rejection

QUOTE_TTL_SECONDS = 120


def respuesta_estadia(stay):
    response = schemas.EstadiaOut.model_validate(stay).model_dump(mode="json")
    branch = stay.torre.sucursal
    response.update(
        torre_numero=stay.torre.numero, sucursal_nombre=branch.nombre,
        sucursal_direccion=branch.direccion, sucursal_telefono=branch.telefono,
        duracion_estadia=duracion_estadia(stay.fecha_entrada_utc, stay.fecha_salida_utc),
    )
    try:
        rules, origin = reglas_de_estadia(stay)
    except HTTPException:
        # Una regla inválida nunca adquiere la cortesía de la configuración actual.
        # Las respuestas antiguas recuperadas por idempotencia también quedan
        # explícitamente desconocidas mediante los defaults del esquema.
        return response
    response.update(cortesia_minutos=rules["cortesia_minutos"], origen_cortesia=origin)
    return response


def reglas_actuales(branch, tower, category):
    if category not in CATEGORIES:
        raise operation_error("CATEGORIA_INVALIDA", "La categoría debe ser AUTO, MOTO o CAMIONETA", 422)
    try:
        return validate_rules({
            "categoria": category,
            "tarifa_hora": str(getattr(branch, {"AUTO": "tarifa_auto", "MOTO": "tarifa_moto", "CAMIONETA": "tarifa_camioneta"}[category])),
            "cortesia_minutos": branch.tiempo_cortesia_min,
            "fraccion_minutos": branch.fraccion_minutos,
            "porcentaje_descuento": str(tower.porcentaje_descuento),
        })
    except ValueError:
        raise operation_error("CONFIGURACION_INVALIDA", "Las reglas de cobro requieren revisión administrativa") from None


def reglas_de_estadia(stay, branch=None):
    if stay.reglas_ingreso is None:
        return reglas_actuales(branch if branch is not None else stay.torre.sucursal,
                               stay.torre, stay.tipo_vehiculo), "HEREDADO_CONFIG_ACTUAL"
    try:
        return validate_rules(stay.reglas_ingreso), "INGRESO"
    except ValueError:
        raise operation_error("SNAPSHOT_INVALIDO", "El snapshot de reglas requiere revisión") from None


def estadia_local(db, estadia_id, sucursal_id, lock=False):
    query = db.query(m.Estadia).join(m.Torre).filter(m.Estadia.id == estadia_id, m.Torre.sucursal_id == sucursal_id)
    if lock:
        query = query.populate_existing().with_for_update(of=m.Estadia)
    stay = query.first()
    if stay is None:
        raise operation_error("ESTADIA_NO_ENCONTRADA", "Estadía no encontrada", 404)
    return stay


def registrar_ingreso_vehiculo(db, patente, torre_id, usuario_ingreso_id, sucursal_id_usuario, tipo, caja_id, key):
    plate = patente.upper().strip()
    payload = {"patente": plate, "torre_id": torre_id, "tipo": tipo, "caja_id": caja_id}
    savepoint = None
    try:
        previous = begin_operation(db, sucursal_id_usuario, usuario_ingreso_id, "INGRESO", key, payload)
        if previous is not None:
            db.rollback()
            return previous, True
        savepoint = db.begin_nested()
        branch = lock_branch(db, sucursal_id_usuario)
        tower = db.query(m.Torre).filter_by(id=torre_id, sucursal_id=sucursal_id_usuario).populate_existing().with_for_update().first()
        if tower is None:
            raise operation_error("SECTOR_NO_AUTORIZADO", "Sector no encontrado o no autorizado", 403)
        exigir_caja_abierta(db, caja_id, sucursal_id_usuario)
        rules = reglas_actuales(branch, tower, tipo)
        duplicate = db.query(m.Estadia).join(m.Vehiculo).filter(
            m.Estadia.sucursal_id == sucursal_id_usuario, m.Estadia.estado == "ACTIVO", m.Vehiculo.patente == plate,
        ).first()
        if duplicate:
            raise operation_error("PATENTE_YA_ACTIVA", "La patente ya tiene una estadía activa en esta sucursal")
        occupancy = db.query(m.Estadia).filter_by(torre_id=torre_id, estado="ACTIVO").count()
        if occupancy >= tower.capacidad:
            raise operation_error("SECTOR_LLENO", "El sector no tiene plazas disponibles")
        # La unicidad global de patente se resuelve sin commit intermedio ni 500
        # ante creaciones concurrentes desde sucursales diferentes.
        db.execute(insert(m.Vehiculo).values(patente=plate, tipo=tipo).on_conflict_do_nothing(index_elements=[m.Vehiculo.patente]))
        vehicle = db.query(m.Vehiculo).filter_by(patente=plate).one()
        now = m.utc_now()
        stay = m.Estadia(vehiculo_id=vehicle.id, torre_id=torre_id, sucursal_id=sucursal_id_usuario,
                        usuario_ingreso_id=usuario_ingreso_id, fecha_entrada=now.replace(tzinfo=None),
                        fecha_entrada_utc=now, monto=Decimal("0.00"), estado="ACTIVO",
                        tipo_vehiculo_registrado=tipo, reglas_ingreso=rules, caja_ingreso_id=caja_id)
        db.add(stay)
        db.flush()
        registrar_evento(db, usuario_ingreso_id, sucursal_id_usuario, "INGRESO_VEHICULO", f"Estadía {stay.id}; patente {plate}; sector {torre_id}; turno {caja_id}")
        response = respuesta_estadia(stay)
        save_operation(db, sucursal_id_usuario, usuario_ingreso_id, "INGRESO", key, payload, response)
        savepoint.commit()
        db.commit()
        return response, False
    except Exception as exc:
        rollback_or_record_rejection(db, exc, savepoint, sucursal_id_usuario, usuario_ingreso_id, "INGRESO", key, payload)
        raise


def cotizar_salida(db, estadia_id, sucursal_id, usuario_id):
    try:
        branch = lock_branch(db, sucursal_id)
        stay = estadia_local(db, estadia_id, sucursal_id, lock=True)
        if stay.estado != "ACTIVO":
            raise operation_error("ESTADIA_FINALIZADA", "La estadía ya fue finalizada")
        if stay.fecha_entrada_utc is None:
            raise operation_error("LEGACY_FECHA_REQUIERE_REVISION", "La fecha heredada no prueba una zona horaria; un ADMIN debe confirmarla explícitamente")
        rules, origin = reglas_de_estadia(stay, branch)
        now = m.utc_now()
        try:
            calculation = calcular_cobro(stay.fecha_entrada_utc, now, rules)
        except ValueError as exc:
            raise operation_error("CALCULO_REQUIERE_REVISION", str(exc)) from None
        quote = m.Cotizacion(id=str(uuid4()), estadia_id=stay.id, sucursal_id=sucursal_id, usuario_id=usuario_id,
                             calculada_en=now, vence_en=now + timedelta(seconds=QUOTE_TTL_SECONDS),
                             monto=calculation.monto, reglas=rules, origen_reglas=origin,
                             explicacion={**calculation.explicacion, "fecha_entrada_utc": stay.fecha_entrada_utc.isoformat()})
        db.add(quote)
        db.flush()
        response = schemas.CotizacionOut.model_validate(quote).model_dump(mode="json")
        db.commit()
        return response
    except Exception:
        db.rollback()
        raise


def consultar_cotizacion(db, quote_id, sucursal_id, usuario_id):
    quote = db.query(m.Cotizacion).filter_by(id=str(quote_id), sucursal_id=sucursal_id, usuario_id=usuario_id).first()
    if quote is None:
        raise operation_error("COTIZACION_NO_ENCONTRADA", "Cotización no encontrada", 404)
    return schemas.CotizacionOut.model_validate(quote).model_dump(mode="json")


def registrar_salida_vehiculo(db, estadia_id, usuario_egreso_id, sucursal_id_usuario, cotizacion_id, caja_id, metodo_pago, key):
    payload = {"estadia_id": estadia_id, "cotizacion_id": str(cotizacion_id), "caja_id": caja_id, "metodo_pago": metodo_pago}
    savepoint = None
    try:
        previous = begin_operation(db, sucursal_id_usuario, usuario_egreso_id, "SALIDA", key, payload)
        if previous is not None:
            db.rollback()
            return previous, True
        savepoint = db.begin_nested()
        lock_branch(db, sucursal_id_usuario)
        exigir_caja_abierta(db, caja_id, sucursal_id_usuario)
        stay = estadia_local(db, estadia_id, sucursal_id_usuario, lock=True)
        if stay.estado != "ACTIVO":
            raise operation_error("ESTADIA_FINALIZADA", "La estadía ya fue cobrada; recuperar su operación")
        quote = db.query(m.Cotizacion).filter_by(id=str(cotizacion_id), estadia_id=estadia_id,
                    sucursal_id=sucursal_id_usuario, usuario_id=usuario_egreso_id).first()
        if quote is None:
            raise operation_error("COTIZACION_NO_ENCONTRADA", "Cotización no encontrada para este intento", 404)
        now = m.utc_now()
        if now >= quote.vence_en:
            raise operation_error("COTIZACION_VENCIDA", "La cotización venció; revisar el importe y confirmar una nueva")
        # El importe confirmado es exactamente el persistido y mostrado. No se
        # recalcula silenciosamente ni se acepta un monto del cliente.
        stay.monto = quote.monto
        stay.cotizacion_id = quote.id
        stay.fecha_salida_utc = now
        stay.fecha_salida = now.replace(tzinfo=None)
        stay.metodo_pago = metodo_pago
        stay.usuario_salida_id = usuario_egreso_id
        stay.caja_id = caja_id
        stay.estado = "FINALIZADO"
        registrar_evento(db, usuario_egreso_id, sucursal_id_usuario, "COBRO_SALIDA",
                        f"Estadía {stay.id}; cotización {quote.id}; ARS {quote.monto}; medio {metodo_pago}; turno {caja_id}")
        db.flush()
        response = respuesta_estadia(stay)
        save_operation(db, sucursal_id_usuario, usuario_egreso_id, "SALIDA", key, payload, response)
        savepoint.commit()
        db.commit()
        return response, False
    except Exception as exc:
        rollback_or_record_rejection(db, exc, savepoint, sucursal_id_usuario, usuario_egreso_id, "SALIDA", key, payload)
        raise


def revisar_fecha_heredada(db, estadia_id, sucursal_id, usuario_id, fecha_entrada_utc, motivo):
    try:
        lock_branch(db, sucursal_id)
        stay = estadia_local(db, estadia_id, sucursal_id, lock=True)
        if stay.estado != "ACTIVO" or stay.fecha_entrada_utc is not None:
            raise operation_error("FECHA_YA_CONFIRMADA", "Sólo puede revisarse una fecha heredada de una estadía activa")
        now = m.utc_now()
        reviewed = fecha_entrada_utc.astimezone(timezone.utc)
        if reviewed > now:
            raise operation_error("FECHA_FUTURA", "El ingreso no puede ser futuro", 422)
        stay.fecha_entrada_utc = reviewed
        registrar_evento(db, usuario_id, sucursal_id, "REVISION_FECHA_HEREDADA",
                        f"Estadía {stay.id}; fecha UTC confirmada {reviewed.isoformat()}; motivo: {motivo}")
        db.flush()
        response = respuesta_estadia(stay)
        db.commit()
        return response
    except Exception:
        db.rollback()
        raise


def obtener_estadias_activas(db, sucursal_id):
    stays = db.query(m.Estadia).options(joinedload(m.Estadia.vehiculo),
                                      joinedload(m.Estadia.torre).joinedload(m.Torre.sucursal)).join(m.Torre).filter(
        m.Estadia.estado == "ACTIVO", m.Torre.sucursal_id == sucursal_id,
    ).order_by(m.Estadia.fecha_entrada.desc()).all()
    return [respuesta_estadia(stay) for stay in stays]


def paginar(query, page, size):
    total = query.count()
    stays = query.options(joinedload(m.Estadia.vehiculo),
                          joinedload(m.Estadia.torre).joinedload(m.Torre.sucursal)).offset((page - 1) * size).limit(size).all()
    return {"total": total, "page": page, "pages": max(1, math.ceil(total / size)),
            "items": [respuesta_estadia(stay) for stay in stays]}


def obtener_historial_paginado(db, sucursal_id, page=1, size=20, patente=None):
    query = db.query(m.Estadia).join(m.Torre).join(m.Vehiculo).filter(
        m.Torre.sucursal_id == sucursal_id, m.Estadia.estado == "FINALIZADO",
    )
    if patente and patente.strip():
        query = query.filter(m.Vehiculo.patente.ilike(f"%{patente.strip()}%"))
    return paginar(query.order_by(m.Estadia.fecha_salida.desc()), page, size)


def comprobantes_propios(db, sucursal_id, usuario_id, permissions, page, size):
    conditions = []
    if "ingreso" in permissions:
        conditions.append(and_(m.Estadia.estado == "ACTIVO", m.Estadia.usuario_ingreso_id == usuario_id))
    if "salida" in permissions:
        conditions.append(and_(m.Estadia.estado == "FINALIZADO", m.Estadia.usuario_salida_id == usuario_id))
    if not conditions:
        return {"total": 0, "page": page, "pages": 1, "items": []}
    query = db.query(m.Estadia).join(m.Torre).filter(m.Torre.sucursal_id == sucursal_id, or_(*conditions))
    return paginar(query.order_by(m.Estadia.id.desc()), page, size)

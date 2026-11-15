from decimal import Decimal
from hashlib import sha256
import json
from sqlalchemy import func

from app.models import db_models as m, schemas
from app.services.audit_service import registrar_evento
from app.services.billing import PAYMENT_METHODS, money
from app.services.idempotency import begin_operation, lock_branch, operation_error, save_operation, rollback_or_record_rejection


def obtener_caja_actual(db, sucursal_id):
    return db.query(m.CierreCaja).filter_by(sucursal_id=sucursal_id, estado="ABIERTA").first()


def exigir_caja_abierta(db, caja_id, sucursal_id):
    caja = db.query(m.CierreCaja).filter_by(id=caja_id, sucursal_id=sucursal_id).populate_existing().with_for_update().first()
    if caja is None:
        raise operation_error("CAJA_NO_ENCONTRADA", "Turno de caja no encontrado", 404)
    if caja.estado != "ABIERTA":
        raise operation_error("CAJA_CERRADA", "El turno indicado está cerrado; actualizar y revisar el intento")
    if caja.origen_datos != "UTC_POR_TURNO":
        raise operation_error("CAJA_HEREDADA_REQUIERE_REVISION", "El turno heredado requiere conciliación; no se inventó una vinculación histórica de cobros")
    return caja


def totales_turno(db, caja_id):
    totals = {method: Decimal("0.00") for method in PAYMENT_METHODS}
    rows = db.query(m.Estadia.metodo_pago, func.sum(m.Estadia.monto)).filter(
        m.Estadia.caja_id == caja_id, m.Estadia.estado == "FINALIZADO",
    ).group_by(m.Estadia.metodo_pago).all()
    for method, amount in rows:
        if method not in totals:
            raise operation_error("MEDIO_HEREDADO_NO_RECONOCIDO", "El turno contiene un medio de pago que requiere revisión")
        totals[method] = money(amount)
    return totals


def respuesta_caja(db, caja):
    result = schemas.CierreCajaOut.model_validate(caja).model_dump(mode="json")
    if caja.estado == "ABIERTA" and caja.origen_datos == "UTC_POR_TURNO":
        totals = totales_turno(db, caja.id)
        result.update({
            "totales_por_medio": {method: str(value) for method, value in totals.items()},
            "recaudacion_total": str(money(sum(totals.values(), Decimal("0")))),
            "monto_esperado": str(money(caja.fondo_inicial + totals["EFECTIVO"])),
        })
    result["revision_cierre"] = revision_cierre(result)
    return result


def revision_cierre(result):
    """Opaque precondition for the concrete turn and its displayed financial state."""
    if (result["origen_datos"] != "UTC_POR_TURNO"
            or result.get("recaudacion_total") is None
            or result.get("totales_por_medio") is None):
        return None
    state = {
        "id": result["id"], "estado": result["estado"],
        "fecha_apertura": result["fecha_apertura"],
        "fondo_inicial": str(money(result["fondo_inicial"])),
        "monto_esperado": str(money(result["monto_esperado"])),
        "recaudacion_total": str(money(result["recaudacion_total"])),
        "totales_por_medio": {
            method: str(money(result["totales_por_medio"].get(method, "0.00")))
            for method in PAYMENT_METHODS
        },
    }
    return sha256(json.dumps(state, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def abrir_caja(db, sucursal_id, usuario_id, key, notas=None):
    payload = {"notas": notas}
    savepoint = None
    try:
        previous = begin_operation(db, sucursal_id, usuario_id, "CAJA_ABRIR", key, payload)
        if previous is not None:
            db.rollback()
            return previous, True
        savepoint = db.begin_nested()
        lock_branch(db, sucursal_id)
        if obtener_caja_actual(db, sucursal_id):
            raise operation_error("CAJA_YA_ABIERTA", "La sucursal ya tiene un turno abierto")
        now = m.utc_now()
        caja = m.CierreCaja(
            sucursal_id=sucursal_id, usuario_id=usuario_id, fecha_apertura=now.replace(tzinfo=None),
            fecha_apertura_utc=now, estado="ABIERTA", fondo_inicial=Decimal("0.00"),
            monto_esperado=Decimal("0.00"), recaudacion_total=Decimal("0.00"),
            totales_por_medio={method: "0.00" for method in PAYMENT_METHODS},
            origen_datos="UTC_POR_TURNO", notas=notas,
        )
        db.add(caja)
        db.flush()
        registrar_evento(db, usuario_id, sucursal_id, "APERTURA_CAJA", f"Turno {caja.id}; fondo inicial ARS 0.00")
        response = respuesta_caja(db, caja)
        save_operation(db, sucursal_id, usuario_id, "CAJA_ABRIR", key, payload, response)
        savepoint.commit()
        db.commit()
        return response, False
    except Exception as exc:
        rollback_or_record_rejection(db, exc, savepoint, sucursal_id, usuario_id, "CAJA_ABRIR", key, payload)
        raise


def cerrar_caja(db, sucursal_id, usuario_id, caja_id, monto_real, notas, key, revision_esperada=None):
    counted = money(monto_real)
    payload = {"caja_id": caja_id, "monto_real": str(counted), "notas": notas}
    # Preserve fingerprints of attempts persisted before this optional guard existed.
    if revision_esperada is not None:
        payload["revision_cierre"] = revision_esperada
    savepoint = None
    try:
        previous = begin_operation(db, sucursal_id, usuario_id, "CAJA_CERRAR", key, payload)
        if previous is not None:
            db.rollback()
            return previous, True
        savepoint = db.begin_nested()
        lock_branch(db, sucursal_id)
        caja = exigir_caja_abierta(db, caja_id, sucursal_id)
        if revision_esperada is not None and revision_esperada != respuesta_caja(db, caja)["revision_cierre"]:
            raise operation_error("CAJA_MODIFICADA", "Los importes del turno cambiaron durante el conteo. Actualizá y revisá los importes antes de confirmar el cierre.")
        totals = totales_turno(db, caja.id)
        caja.monto_esperado = money(caja.fondo_inicial + totals["EFECTIVO"])
        caja.recaudacion_total = money(sum(totals.values(), Decimal("0")))
        caja.monto_real = counted
        caja.diferencia = (counted - caja.monto_esperado).quantize(Decimal("0.01"))
        caja.totales_por_medio = {method: str(value) for method, value in totals.items()}
        now = m.utc_now()
        caja.fecha_cierre = now.replace(tzinfo=None)
        caja.fecha_cierre_utc = now
        caja.estado = "CERRADA"
        # Las notas no reemplazan el desglose: ambos se conservan en campos propios.
        caja.notas = notas if notas is not None else caja.notas
        registrar_evento(db, usuario_id, sucursal_id, "CIERRE_CAJA",
                        f"Turno {caja.id}; recaudación ARS {caja.recaudacion_total}; efectivo esperado {caja.monto_esperado}; contado {counted}")
        db.flush()
        response = respuesta_caja(db, caja)
        save_operation(db, sucursal_id, usuario_id, "CAJA_CERRAR", key, payload, response)
        savepoint.commit()
        db.commit()
        return response, False
    except Exception as exc:
        rollback_or_record_rejection(db, exc, savepoint, sucursal_id, usuario_id, "CAJA_CERRAR", key, payload)
        raise

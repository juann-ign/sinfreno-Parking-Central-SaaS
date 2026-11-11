"""Resultados durables por sucursal, comando y autor; sin estados parciales confirmados."""
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import text

from app.models import db_models as m

REJECTION_FIELD = "_rechazo_idempotente"


def resolved_response(response, replayed=True):
    if REJECTION_FIELD in response:
        decision = response[REJECTION_FIELD]
        raise HTTPException(status_code=decision["status_code"], detail=decision["detail"], headers={
            "Idempotency-Resolved": "true", "Idempotency-Replayed": str(replayed).lower(),
        })
    return response


def operation_error(code, message, status=409):
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def lock_branch(db, branch_id):
    branch = db.query(m.Sucursal).filter_by(id=branch_id).populate_existing().with_for_update().first()
    if branch is None:
        raise operation_error("SUCURSAL_NO_ENCONTRADA", "Sucursal no encontrada", 404)
    return branch


def fingerprint(payload):
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def begin_operation(db, branch_id, user_id, kind, key, payload):
    identity = f"sinfreno:{branch_id}:{kind}:{key}".encode()
    lock_id = int.from_bytes(hashlib.sha256(identity).digest()[:8], "big", signed=True)
    db.execute(text("SELECT pg_advisory_xact_lock(:operation_lock)"), {"operation_lock": lock_id})
    previous = db.query(m.OperacionIdempotente).filter_by(sucursal_id=branch_id, tipo=kind, clave=key).first()
    if previous is None:
        return None
    if previous.usuario_id != user_id:
        raise operation_error("OPERACION_NO_ENCONTRADA", "Operación no encontrada", 404)
    if previous.huella != fingerprint(payload):
        raise operation_error("CLAVE_REUTILIZADA", "La clave identifica un pedido diferente; recuperar el intento original")
    return resolved_response(previous.respuesta)


def save_operation(db, branch_id, user_id, kind, key, payload, response):
    db.add(m.OperacionIdempotente(sucursal_id=branch_id, usuario_id=user_id, tipo=kind,
                                clave=key, huella=fingerprint(payload), respuesta=response))


def rollback_or_record_rejection(db, error, savepoint, branch_id, user_id, kind, key, payload):
    """Conservar la exclusión por clave al deshacer un rechazo de dominio.

    El SAVEPOINT revierte cualquier cambio de negocio, pero el advisory lock del
    transaction padre sigue retenido hasta guardar la decisión. Una request que
    llegó tarde con la misma clave nunca puede ejecutarse después del rechazo.
    Auth, validación de body, autor ajeno y payload distinto ocurren antes de este
    savepoint. Los errores 500 no producen decisiones duraderas ficticias.
    """
    if not (
        savepoint is not None and savepoint.is_active
        and isinstance(error, HTTPException) and 400 <= error.status_code < 500
        and isinstance(error.detail, dict) and "code" in error.detail
    ):
        db.rollback()
        return
    try:
        savepoint.rollback()
        save_operation(db, branch_id, user_id, kind, key, payload, {
            REJECTION_FIELD: {"status_code": error.status_code, "detail": error.detail},
        })
        db.commit()
    except Exception:
        db.rollback()
        raise
    error.headers = {**(error.headers or {}), "Idempotency-Resolved": "true", "Idempotency-Replayed": "false"}


def operation_result(db, branch_id, user_id, kind, key):
    operation = db.query(m.OperacionIdempotente).filter_by(
        sucursal_id=branch_id, usuario_id=user_id, tipo=kind, clave=key,
    ).first()
    if operation is None:
        raise operation_error("OPERACION_NO_ENCONTRADA", "Todavía no hay un resultado confirmado para este intento", 404)
    return resolved_response(operation.respuesta)

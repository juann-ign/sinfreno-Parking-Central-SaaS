from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api import dependencies
from app.api.operation_inputs import RecordId, idempotency_key
from app.models import schemas, db_models as m
from app.services import caja_service
from app.services.events import publish_change
from app.services.idempotency import operation_error

router = APIRouter(prefix="/cash", tags=["Cash Management"])


@router.get("/status", response_model=schemas.CierreCajaOut | schemas.CajaOperativaOut)
def get_status(db: Session = Depends(dependencies.get_db),
               current_user: m.Usuario = Depends(dependencies.require_operational_user)):
    caja = caja_service.obtener_caja_actual(db, current_user.sucursal_id)
    if caja is None:
        raise HTTPException(status_code=404, detail="No hay caja abierta")
    if dependencies.normalized_role(current_user) == "ADMIN":
        return caja_service.respuesta_caja(db, caja)
    return schemas.CajaOperativaOut.model_validate(caja)


@router.post("/abrir", response_model=schemas.CierreCajaOut)
def abrir(data: schemas.CierreCajaCreate, background_tasks: BackgroundTasks, response: Response,
          key: str = Depends(idempotency_key), db: Session = Depends(dependencies.get_db),
          current_user: m.Usuario = Depends(dependencies.require_local_admin)):
    scope = current_user.sucursal_id
    result, replayed = caja_service.abrir_caja(db, scope, current_user.id, key, data.notas)
    response.headers["Idempotency-Replayed"] = str(replayed).lower()
    response.headers["Idempotency-Resolved"] = "true"
    if not replayed:
        background_tasks.add_task(publish_change, "CONFIG_UPDATED", scope)
    return result


@router.post("/cerrar")
def legacy_cerrar(current_user: m.Usuario = Depends(dependencies.require_local_admin)):
    raise operation_error("COMANDO_CON_IDS_REQUERIDO", "Cerrar por ID de caja e Idempotency-Key; la caja actual no identifica un reintento", 422)


@router.post("/{caja_id}/cerrar", response_model=schemas.CierreCajaOut)
def cerrar(caja_id: RecordId, data: schemas.CierreCajaFinalizar, background_tasks: BackgroundTasks,
           response: Response, key: str = Depends(idempotency_key),
           db: Session = Depends(dependencies.get_db),
           current_user: m.Usuario = Depends(dependencies.require_local_admin)):
    scope = current_user.sucursal_id
    result, replayed = caja_service.cerrar_caja(db, scope, current_user.id, caja_id,
                                              data.monto_real, data.notas, key, data.revision_cierre)
    response.headers["Idempotency-Replayed"] = str(replayed).lower()
    response.headers["Idempotency-Resolved"] = "true"
    if not replayed:
        background_tasks.add_task(publish_change, "CONFIG_UPDATED", scope)
    return result


@router.get("/history", response_model=list[schemas.CierreCajaOut])
def get_cash_history(db: Session = Depends(dependencies.get_db),
                     current_user: m.Usuario = Depends(dependencies.require_local_admin)):
    boxes = db.query(m.CierreCaja).filter_by(sucursal_id=current_user.sucursal_id).order_by(m.CierreCaja.id.desc()).all()
    return [caja_service.respuesta_caja(db, caja) for caja in boxes]

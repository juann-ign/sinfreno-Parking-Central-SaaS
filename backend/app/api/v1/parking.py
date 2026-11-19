from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Response, Query
from sqlalchemy.orm import Session
from app.api import dependencies
from app.models import schemas, db_models
from app.services import parking_service, pdf_service
from app.api.operation_inputs import RecordId, idempotency_key
from app.services.events import publish_change
from app.services.idempotency import operation_error, operation_result
from typing import Literal
from uuid import UUID

router = APIRouter(prefix="/parking", tags=["Parking Operations"])

@router.post("/ingreso", response_model=schemas.EstadiaOut)
def ingreso(
    data: schemas.EstadiaCreate,
    background_tasks: BackgroundTasks,
    response: Response,
    key: str = Depends(idempotency_key),
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.PermissionChecker("ingreso"))
):
    scope = current_user.sucursal_id
    result, replayed = parking_service.registrar_ingreso_vehiculo(
        db, data.patente, data.torre_id, current_user.id, scope, data.tipo, data.caja_id, key,
    )
    response.headers["Idempotency-Replayed"] = str(replayed).lower()
    response.headers["Idempotency-Resolved"] = "true"
    if not replayed:
        background_tasks.add_task(publish_change, "NUEVO_INGRESO", scope, result["id"])
    return result

@router.post("/salida")
def legacy_salida(current_user: db_models.Usuario = Depends(dependencies.PermissionChecker("salida"))):
    raise operation_error("COMANDO_CON_IDS_REQUERIDO", "Cotizar y confirmar por ID de estadía, cotización y caja; la patente no identifica un reintento", 422)


@router.post("/{estadia_id}/cotizaciones", response_model=schemas.CotizacionOut)
def cotizar(estadia_id: RecordId, db: Session = Depends(dependencies.get_db),
            current_user: db_models.Usuario = Depends(dependencies.PermissionChecker("salida"))):
    return parking_service.cotizar_salida(db, estadia_id, current_user.sucursal_id, current_user.id)


@router.get("/cotizaciones/{cotizacion_id}", response_model=schemas.CotizacionOut)
def consultar_cotizacion(cotizacion_id: UUID, db: Session = Depends(dependencies.get_db),
                         current_user: db_models.Usuario = Depends(dependencies.PermissionChecker("salida"))):
    return parking_service.consultar_cotizacion(db, cotizacion_id, current_user.sucursal_id, current_user.id)


@router.post("/{estadia_id}/salida", response_model=schemas.EstadiaOut)
def confirmar_salida(estadia_id: RecordId, data: schemas.SalidaConfirmar, background_tasks: BackgroundTasks,
                     response: Response, key: str = Depends(idempotency_key),
                     db: Session = Depends(dependencies.get_db),
                     current_user: db_models.Usuario = Depends(dependencies.PermissionChecker("salida"))):
    scope = current_user.sucursal_id
    result, replayed = parking_service.registrar_salida_vehiculo(
        db, estadia_id, current_user.id, scope, data.cotizacion_id, data.caja_id, data.metodo_pago, key,
    )
    response.headers["Idempotency-Replayed"] = str(replayed).lower()
    response.headers["Idempotency-Resolved"] = "true"
    if not replayed:
        background_tasks.add_task(publish_change, "NUEVA_SALIDA", scope, result["id"])
    return result


@router.get("/operaciones/{tipo}/{clave}")
def recuperar_operacion(tipo: Literal["INGRESO", "SALIDA", "CAJA_ABRIR", "CAJA_CERRAR"], clave: str,
                        db: Session = Depends(dependencies.get_db),
                        current_user: db_models.Usuario = Depends(dependencies.get_current_branch_user)):
    permissions = dependencies.effective_permissions(current_user)
    if (
        (tipo == "INGRESO" and "ingreso" not in permissions)
        or (tipo == "SALIDA" and "salida" not in permissions)
        or (tipo.startswith("CAJA_") and dependencies.normalized_role(current_user) != "ADMIN")
    ):
        raise operation_error("PERMISO_INSUFICIENTE", "No tiene permiso para recuperar esa operación", 403)
    return operation_result(db, current_user.sucursal_id, current_user.id, tipo, clave)


@router.get("/comprobantes-propios", response_model=schemas.EstadiaPaginated)
def comprobantes_propios(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                         db: Session = Depends(dependencies.get_db),
                         current_user: db_models.Usuario = Depends(dependencies.require_operational_user)):
    return parking_service.comprobantes_propios(db, current_user.sucursal_id, current_user.id,
                                              dependencies.effective_permissions(current_user), page, size)


@router.post("/{estadia_id}/revisar-fecha", response_model=schemas.EstadiaOut)
def revisar_fecha(estadia_id: RecordId, data: schemas.FechaHeredadaRevision,
                   db: Session = Depends(dependencies.get_db),
                   current_user: db_models.Usuario = Depends(dependencies.require_local_admin)):
    return parking_service.revisar_fecha_heredada(db, estadia_id, current_user.sucursal_id,
                                                current_user.id, data.fecha_entrada_utc, data.motivo)

@router.get("/activas", response_model=list[schemas.EstadiaOut])
def listar_activas(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.require_operational_user)
):
        # La lógica de filtrado ahora depende de quién hace la petición
    return parking_service.obtener_estadias_activas(db, current_user.sucursal_id)

@router.get("/historial", response_model=schemas.EstadiaPaginated)
def listar_historial(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    patente: str = None,
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.PermissionChecker("ver_historial"))
):
    return parking_service.obtener_historial_paginado(db, current_user.sucursal_id, page, size, patente)

@router.get("/config", response_model=schemas.SucursalOut)
def get_config(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.require_operational_user)
):
    """Retorna la configuración y torres de la sucursal del usuario actual."""
    sucursal = db.query(db_models.Sucursal).filter(
        db_models.Sucursal.id == current_user.sucursal_id
    ).first()
    
    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")
    return sucursal

@router.patch("/config", response_model=schemas.SucursalOut)
def update_config(
    obj_in: schemas.SucursalUpdate,
    background_tasks: BackgroundTasks, 
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.require_local_admin)
):
    # 1. Buscamos la sucursal del usuario actual
    sucursal = db.query(db_models.Sucursal).filter(
        db_models.Sucursal.id == current_user.sucursal_id
    ).first()

    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    # La marca vive en Empresa, compartida por sucursales hermanas. Un ADMIN
    # local sólo puede reenviar sus valores actuales, nunca cambiarlos globalmente.
    if (
        (obj_in.logo_url is not None and obj_in.logo_url != sucursal.empresa.logo_url)
        or (obj_in.color_primario is not None and obj_in.color_primario != sucursal.empresa.color_primario)
    ):
        raise HTTPException(status_code=403, detail="La marca de empresa requiere gestión global")

    # 2. Actualizamos los campos de la sucursal (Nuevos campos dinámicos)
    if obj_in.nombre is not None:
        sucursal.nombre = obj_in.nombre
    for field in ("direccion", "telefono"):
        if field in obj_in.model_fields_set:
            setattr(sucursal, field, getattr(obj_in, field))

     # Actualizamos las 3 tarifas
    if obj_in.tarifa_auto is not None:
        sucursal.tarifa_auto = obj_in.tarifa_auto
    if obj_in.tarifa_moto is not None:
        sucursal.tarifa_moto = obj_in.tarifa_moto
    if obj_in.tarifa_camioneta is not None:
        sucursal.tarifa_camioneta = obj_in.tarifa_camioneta

    # Reglas de tiempo
    if obj_in.tiempo_cortesia_min is not None:
        sucursal.tiempo_cortesia_min = obj_in.tiempo_cortesia_min
    if obj_in.fraccion_minutos is not None:
        sucursal.fraccion_minutos = obj_in.fraccion_minutos

    scope = current_user.sucursal_id

    db.commit()
    db.refresh(sucursal)
    background_tasks.add_task(publish_change, "CONFIG_UPDATED", scope)
    return sucursal

@router.get("/auditoria", response_model=list[schemas.AuditoriaOut])
def obtener_logs(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.require_local_admin)
):
    return db.query(db_models.Auditoria).filter(
        db_models.Auditoria.sucursal_id == current_user.sucursal_id
    ).order_by(db_models.Auditoria.fecha.desc()).limit(100).all()

@router.get("/{estadia_id}/pdf")
def download_ticket_pdf(
    estadia_id: RecordId,
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_branch_user),
    tipo: Literal["INGRESO", "SALIDA"] | None = None,
):
    estadia = db.query(db_models.Estadia).join(db_models.Torre).filter(
        db_models.Estadia.id == estadia_id,
        db_models.Torre.sucursal_id == current_user.sucursal_id,
    ).first()
    if not estadia:
        raise HTTPException(status_code=404, detail="Estadía no encontrada")

    permissions = dependencies.effective_permissions(current_user)
    if not (
        "ver_historial" in permissions
        or (
            "ingreso" in permissions and estadia.estado == "ACTIVO"
            and estadia.usuario_ingreso_id == current_user.id
        )
        or ("salida" in permissions and estadia.usuario_salida_id == current_user.id)
    ):
        raise HTTPException(status_code=403, detail="Permiso insuficiente para el comprobante")
    tipo_actual = "SALIDA" if estadia.estado == "FINALIZADO" else "INGRESO"
    if tipo is not None and tipo != tipo_actual:
        raise operation_error("COMPROBANTE_ACTUALIZADO", "La estadía cambió. Abrí el comprobante actualizado.")

    pdf_content = pdf_service.generar_pdf_ticket(estadia)
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=ticket_{estadia.id}.pdf",
            "Cache-Control": "no-store",
        },
    )

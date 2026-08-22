from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Response
from app.core.websocket_manager import manager 
from sqlalchemy.orm import Session
from app.api import dependencies
from app.models import schemas, db_models
from app.services import parking_service, pdf_service

router = APIRouter(prefix="/parking", tags=["Parking Operations"])

@router.post("/ingreso", response_model=schemas.EstadiaOut)
async def ingreso(
    data: schemas.EstadiaCreate, 
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    # 1. Ejecutamos la lógica de DB (sincrónica)
    nueva_estadia = parking_service.registrar_ingreso_vehiculo(
        db, data.patente, data.torre_id, current_user.id, current_user.sucursal_id, data.tipo
    )
     # Notificación inmediata por WebSocket
    await manager.broadcast( 
        {"event": "NUEVO_INGRESO", "id": nueva_estadia.id, "patente": data.patente.upper(), "tipo": data.tipo},
        current_user.sucursal_id
    )

    return nueva_estadia
    
@router.post("/salida", response_model=schemas.EstadiaOut)
async def salida(patente: str, metodo_pago: str = "EFECTIVO", db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
    ):
    estadia = parking_service.registrar_salida_vehiculo(db, patente, current_user.id, metodo_pago)

    # Notificación inmediata por WebSocket
    await manager.broadcast( 
        {
            "event": "NUEVA_SALIDA", 
            "patente": patente.upper(), 
            "monto": estadia.monto,
            "metodo_pago": metodo_pago,
            "tipo": estadia.tipo_vehiculo,
            "fecha_entrada": estadia.fecha_entrada.isoformat(),
            "fecha_salida": estadia.fecha_salida.isoformat(),
            "id": estadia.id,
        },
        current_user.sucursal_id
    )

    return estadia

@router.get("/activas", response_model=list[schemas.EstadiaOut])
def listar_activas(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
        # La lógica de filtrado ahora depende de quién hace la petición
    return parking_service.obtener_estadias_activas(db, current_user.sucursal_id)

@router.get("/historial", response_model=schemas.EstadiaPaginated)
def listar_historial(
    page: int = 1, 
    size: int = 20,
    patente: str = None,
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    return parking_service.obtener_historial_paginado(db, current_user.sucursal_id, page, size, patente)

@router.get("/config", response_model=schemas.SucursalOut)
def get_config(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
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
    current_user: db_models.Usuario = Depends(dependencies.RoleChecker(["ADMIN"]))
):
    # 1. Buscamos la sucursal del usuario actual
    sucursal = db.query(db_models.Sucursal).filter(
        db_models.Sucursal.id == current_user.sucursal_id
    ).first()

    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    # 2. Actualizamos los campos de la sucursal (Nuevos campos dinámicos)
    if obj_in.nombre is not None:
        sucursal.nombre = obj_in.nombre

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

     # 3. White-label: Campos en la tabla 'Empresa'
    if obj_in.logo_url is not None or obj_in.color_primario is not None:
        empresa = sucursal.empresa
        if obj_in.logo_url is not None: empresa.logo_url = obj_in.logo_url
        if obj_in.color_primario is not None: empresa.color_primario = obj_in.color_primario

    background_tasks.add_task(
        manager.broadcast,
        {"event": "CONFIG_UPDATED"},
        current_user.sucursal_id
    )

    db.commit()
    db.refresh(sucursal)
    return sucursal

@router.get("/auditoria", response_model=list[schemas.AuditoriaOut])
def obtener_logs(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.RoleChecker(["ADMIN"]))
):
    return db.query(db_models.Auditoria).filter(
        db_models.Auditoria.sucursal_id == current_user.sucursal_id
    ).order_by(db_models.Auditoria.fecha.desc()).limit(100).all()

@router.get("/{estadia_id}/pdf")
def download_ticket_pdf(
    estadia_id: int, 
    db: Session = Depends(dependencies.get_db)
):
    estadia = db.query(db_models.Estadia).filter(db_models.Estadia.id == estadia_id).first()
    if not estadia:
        raise HTTPException(status_code=404, detail="Estadía no encontrada")
        
    pdf_content = pdf_service.generar_pdf_ticket(estadia)
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=ticket_{estadia.patente}.pdf"}
    )
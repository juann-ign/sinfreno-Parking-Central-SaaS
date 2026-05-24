from fastapi import APIRouter, Depends, BackgroundTasks
from app.core.websocket_manager import manager 
from sqlalchemy.orm import Session
from app.api import dependencies
from app.models import schemas, db_models
from app.services import parking_service

router = APIRouter(prefix="/parking", tags=["Parking Operations"])

@router.post("/ingreso", response_model=schemas.EstadiaOut)
def ingreso(
    data: schemas.EstadiaCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(dependencies.get_db),
    # El usuario viene del token y se inyecta automáticamente gracias a Depends
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    # 1. Ejecutamos la lógica de DB (sincrónica)
    nueva_estadia = parking_service.registrar_ingreso_vehiculo(
        db=db, patente=data.patente, torre_id=data.torre_id, usuario_ingreso_id=current_user.id, tipo=data.tipo
    )

    # 2. Programamos la notificación WebSocket como tarea de fondo
    # Esto no bloquea la respuesta al cliente
    background_tasks.add_task(
        manager.broadcast, 
        {"event": "NUEVO_INGRESO", "patente": data.patente.upper(), "torre_id": data.torre_id, "tipo": data.tipo}
    )

    # Usamos current_user.id extraído del JWT
    return nueva_estadia
    
@router.post("/salida", response_model=schemas.EstadiaOut)
async def salida(patente: str, background_tasks: BackgroundTasks, db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
    ):
    estadia = parking_service.registrar_salida_vehiculo(db, patente, current_user.id)

    background_tasks.add_task(
        manager.broadcast, 
        {"event": "NUEVA_SALIDA", "patente": patente.upper(), "torre_id": estadia.torre_id, "tipo": estadia.tipo_vehiculo}
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
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.api import dependencies
from app.models import schemas, db_models
from app.services import caja_service 
from app.services.notification_service import send_telegram_message, format_cash_report

router = APIRouter(prefix="/cash", tags=["Cash Management"])

@router.get("/status", response_model=schemas.CierreCajaOut)
def get_status(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    """Retorna la caja abierta actual o 404 si no hay ninguna."""
    # Usamos la función del service que definimos antes
    caja = caja_service.obtener_caja_actual(db, current_user.sucursal_id)
    if not caja:
        raise HTTPException(status_code=404, detail="No hay caja abierta")
    return caja

@router.post("/abrir", response_model=schemas.CierreCajaOut)
def abrir(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    return caja_service.abrir_caja(db, current_user.sucursal_id, current_user.id)

@router.post("/cerrar", response_model=schemas.CierreCajaOut)
def cerrar(
    data: schemas.CierreCajaFinalizar,
    background_tasks: BackgroundTasks,
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    caja = caja_service.cerrar_caja(
        db, 
        current_user.sucursal_id, 
        data.monto_real, 
        data.notas
    )

    # 2. Agregamos la notificación a la cola de segundo plano
    mensaje = format_cash_report(caja, current_user.sucursal.nombre)
    background_tasks.add_task(send_telegram_message, mensaje)

    return caja

@router.get("/history", response_model=list[schemas.CierreCajaOut])
def get_cash_history(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    """Retorna todos los cierres de caja de la sucursal actual."""
    return db.query(db_models.CierreCaja).filter(
        db_models.CierreCaja.sucursal_id == current_user.sucursal_id
    ).order_by(db_models.CierreCaja.fecha_apertura.desc()).all()
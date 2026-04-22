from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import db_models
from datetime import datetime, timezone, timedelta

def get_dashboard_summary(db: Session, sucursal_id: int):
    # 1. Ocupación Actual
    autos_adentro = db.query(db_models.Estadia).join(db_models.Torre).filter(
        db_models.Torre.sucursal_id == sucursal_id,
        db_models.Estadia.estado == "ACTIVO"
    ).count()

    # 2. Capacidad Total de la sucursal
    capacidad_total = db.query(func.sum(db_models.Torre.capacidad)).filter(
        db_models.Torre.sucursal_id == sucursal_id
    ).scalar() or 0

    # 3. Recaudación Real (Hoy)
    hoy_inicio = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    recaudacion_hoy = db.query(func.sum(db_models.Estadia.monto)).join(db_models.Torre).filter(
        db_models.Torre.sucursal_id == sucursal_id,
        db_models.Estadia.estado == "FINALIZADO",
        db_models.Estadia.fecha_salida >= hoy_inicio
    ).scalar() or 0.0

    return {
        "autos_adentro": autos_adentro,
        "capacidad_disponible": capacidad_total - autos_adentro,
        "porcentaje_ocupacion": round((autos_adentro / capacidad_total * 100), 2) if capacidad_total > 0 else 0,
        "recaudacion_hoy": recaudacion_hoy
    }
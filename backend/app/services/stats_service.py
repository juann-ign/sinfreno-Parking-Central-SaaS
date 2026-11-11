from sqlalchemy.orm import Session
from sqlalchemy import func
import sqlalchemy as sa
from app.models import db_models
from app.core.config import settings
from app.core.timezone_utils import get_today_range_utc
from decimal import Decimal

def get_dashboard_summary(db: Session, sucursal_id: int, include_financial: bool = False):
    # Usamos el helper para filtrar "Hoy" según Argentina
    inicio_utc, fin_utc = get_today_range_utc()

    # 1. Ocupación Actual
    autos_adentro = db.query(db_models.Estadia).join(db_models.Torre).filter(
        db_models.Torre.sucursal_id == sucursal_id,
        db_models.Estadia.estado == "ACTIVO"
    ).count()

    # 2. Capacidad Total de la sucursal
    capacidad_total = db.query(func.sum(db_models.Torre.capacidad)).filter(
        db_models.Torre.sucursal_id == sucursal_id
    ).scalar() or 0

    summary = {
        "autos_adentro": autos_adentro,
        "capacidad_disponible": capacidad_total - autos_adentro,
        "porcentaje_ocupacion": round((autos_adentro / capacidad_total * 100), 2) if capacidad_total > 0 else 0,
    }
    if include_financial:
        summary["recaudacion_hoy"] = db.query(func.sum(db_models.Estadia.monto)).join(db_models.Torre).filter(
            db_models.Torre.sucursal_id == sucursal_id,
            db_models.Estadia.estado == "FINALIZADO",
            db_models.Estadia.fecha_salida_utc >= inicio_utc,
            db_models.Estadia.fecha_salida_utc <= fin_utc,
        ).scalar() or Decimal("0.00")
    return summary

def get_hourly_revenue(db: Session, sucursal_id: int):
    inicio_utc, fin_utc = get_today_range_utc()
    tz_local = settings.APP_TZ
    
    # Usamos func.extract para obtener la hora de la fecha_salida
    # Filtramos por sucursal, estado FINALIZADO y que la salida sea HOY
    results = db.query(
        func.extract('hour', db_models.Estadia.fecha_salida_utc.op('AT TIME ZONE')(tz_local)).label('hora'),
        func.sum(db_models.Estadia.monto).label('monto')
    ).join(db_models.Torre).filter(
        db_models.Torre.sucursal_id == sucursal_id,
        db_models.Estadia.estado == "FINALIZADO",
        db_models.Estadia.fecha_salida_utc >= inicio_utc,
        db_models.Estadia.fecha_salida_utc <= fin_utc
    ).group_by('hora').order_by('hora').all()

    # Convertimos los resultados de la DB (tuplas) a una lista de diccionarios
    return [{"hora": int(r.hora), "monto": r.monto} for r in results]

def get_peak_hour(db: Session, sucursal_id: int):
    """
    Calcula la hora con mayor volumen de ingresos en la historia de la sucursal.
    Arquitectura: Agrupamiento (GROUP BY) y Conteo (COUNT) a nivel DB para eficiencia.
    """
    # Extraemos la hora de la fecha_entrada y contamos
    result = db.query(
        func.extract('hour', db_models.Estadia.fecha_entrada_utc.op('AT TIME ZONE')(settings.APP_TZ)).label('hora'),
        func.count(db_models.Estadia.id).label('cantidad')
    ).join(db_models.Torre).filter(
        db_models.Torre.sucursal_id == sucursal_id,
        db_models.Estadia.fecha_entrada_utc.isnot(None),
    ).group_by('hora').order_by(sa.desc('cantidad')).first()

    if not result:
        return {"hora_pico": None, "volumen": 0}
    
    return {"hora_pico": int(result.hora), "volumen": result.cantidad}

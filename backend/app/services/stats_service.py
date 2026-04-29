from sqlalchemy.orm import Session
from sqlalchemy import func
import sqlalchemy as sa
from app.models import db_models
from zoneinfo import ZoneInfo
from app.core.config import settings
from app.core.timezone_utils import get_today_range_utc

def get_dashboard_summary(db: Session, sucursal_id: int):
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

    # 3. Recaudación Real (Hoy)
    recaudacion_hoy = db.query(func.sum(db_models.Estadia.monto)).join(db_models.Torre).filter(
        db_models.Torre.sucursal_id == sucursal_id,
        db_models.Estadia.estado == "FINALIZADO",
        db_models.Estadia.fecha_salida >= inicio_utc,
        db_models.Estadia.fecha_salida <= fin_utc
    ).scalar() or 0.0

    return {
        "autos_adentro": autos_adentro,
        "capacidad_disponible": capacidad_total - autos_adentro,
        "porcentaje_ocupacion": round((autos_adentro / capacidad_total * 100), 2) if capacidad_total > 0 else 0,
        "recaudacion_hoy": recaudacion_hoy
    }

def get_hourly_revenue(db: Session, sucursal_id: int):
    inicio_utc, fin_utc = get_today_range_utc()
    tz_local = settings.APP_TZ
    
    # Usamos func.extract para obtener la hora de la fecha_salida
    # Filtramos por sucursal, estado FINALIZADO y que la salida sea HOY
    results = db.query(
        func.extract('hour', db_models.Estadia.fecha_salida.op('AT TIME ZONE')('UTC').op('AT TIME ZONE')(tz_local)).label('hora'),
        func.sum(db_models.Estadia.monto).label('monto')
    ).join(db_models.Torre).filter(
        db_models.Torre.sucursal_id == sucursal_id,
        db_models.Estadia.estado == "FINALIZADO",
        db_models.Estadia.fecha_salida >= inicio_utc,
        db_models.Estadia.fecha_salida <= fin_utc
    ).group_by('hora').order_by('hora').all()

    # Convertimos los resultados de la DB (tuplas) a una lista de diccionarios
    return [{"hora": int(r.hora), "monto": float(r.monto)} for r in results]

def get_peak_hour(db: Session, sucursal_id: int):
    """
    Calcula la hora con mayor volumen de ingresos en la historia de la sucursal.
    Arquitectura: Agrupamiento (GROUP BY) y Conteo (COUNT) a nivel DB para eficiencia.
    """
    # Extraemos la hora de la fecha_entrada y contamos
    result = db.query(
        func.extract('hour', db_models.Estadia.fecha_entrada).label('hora'),
        func.count(db_models.Estadia.id).label('cantidad')
    ).join(db_models.Torre).filter(
        db_models.Torre.sucursal_id == sucursal_id
    ).group_by('hora').order_by(sa.desc('cantidad')).first()

    if not result:
        return {"hora_pico": None, "volumen": 0}
    
    return {"hora_pico": int(result.hora), "volumen": result.cantidad}
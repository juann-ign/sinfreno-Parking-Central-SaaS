from datetime import datetime
from zoneinfo import ZoneInfo
from app.core.config import settings

def get_now_local():
    """Retorna el datetime actual en la zona horaria de la App."""
    return datetime.now(ZoneInfo(settings.APP_TZ))

def get_today_range_utc():
    """
    Retorna el inicio y fin del día actual de Argentina, 
    pero expresado en UTC para consultas de base de datos.
    """
    tz = ZoneInfo(settings.APP_TZ)
    local_now = datetime.now(tz)
    
    # Inicio del día (00:00:00) en Argentina
    inicio_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Fin del día (23:59:59) en Argentina
    fin_local = local_now.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # Convertimos ambos a UTC para que la DB los entienda
    return inicio_local.astimezone(ZoneInfo("UTC")), fin_local.astimezone(ZoneInfo("UTC"))
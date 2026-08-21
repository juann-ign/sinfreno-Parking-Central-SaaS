try:
    import httpx  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover
    httpx = None

from app.core.config import settings
from app.core.logger import logger

async def send_telegram_message(message: str):
    """Envía un mensaje asíncrono al bot de Telegram configurado."""
    if not settings.TELEGRAM_TOKEN or not settings.TELEGRAM_CHAT_ID:
        logger.warning("Telegram no configurado. Saltando notificación.")
        return

    if httpx is None:
        logger.warning("httpx no está instalado. No se puede enviar notificación por Telegram.")
        return

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": settings.TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=10.0)
            if response.status_code != 200:
                logger.error(f"Error Telegram: {response.text}")
    except Exception as e:
        logger.error(f"Falla al enviar Telegram: {e}")

def format_cash_report(caja, sucursal_nombre: str):
    """Formatea el reporte de cierre para Telegram."""
    emoji_status = "✅" if caja.diferencia == 0 else "⚠️"
    
    return (
        f"<b>{emoji_status} CIERRE DE CAJA - {sucursal_nombre}</b>\n\n"
        f"👤 <b>Operador ID:</b> {caja.usuario_id}\n"
        f"💰 <b>Esperado:</b> ${caja.monto_esperado:,.2f}\n"
        f"💵 <b>Real:</b> ${caja.monto_real:,.2f}\n"
        f"📊 <b>Diferencia:</b> ${caja.diferencia:,.2f}\n\n"
        f"📝 <b>Notas:</b> {caja.notes or 'Sin notas'}\n"
        f"📅 <i>{caja.fecha_cierre.strftime('%d/%m/%Y %H:%M')}</i>"
    )
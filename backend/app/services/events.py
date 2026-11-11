"""Una notificación nunca cambia el resultado de una transacción ya confirmada."""
import logging
from app.core.websocket_manager import manager

logger = logging.getLogger("sinfreno")


async def publish_change(event, sucursal_id, operation_id=None):
    payload = {"event": event}
    if operation_id is not None:
        payload["id"] = operation_id
    try:
        await manager.broadcast(payload, sucursal_id)
    except Exception:
        logger.warning("No se pudo publicar una actualización ya confirmada")

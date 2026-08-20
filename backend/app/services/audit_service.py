from sqlalchemy.orm import Session
from app.models import db_models

def registrar_evento(db: Session, usuario_id: int, sucursal_id: int, accion: str, detalles: str):
    nuevo_log = db_models.Auditoria(
        usuario_id=usuario_id,
        sucursal_id=sucursal_id,
        accion=accion,
        detalles=detalles
    )
    db.add(nuevo_log)

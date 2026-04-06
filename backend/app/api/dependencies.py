from typing import Generator
from sqlalchemy.orm import Session
from app.core.database import SessionLocal

def get_db() -> Generator[Session, None, None]:
    """
    Dependency que provee una sesión de base de datos para cada petición.
    Garantiza que la sesión se cierre automáticamente al finalizar el request.
    """
    db = SessionLocal()
    try:
        # El 'yield' es clave: entrega la sesión al endpoint y 
        # pausa la ejecución de esta función hasta que el endpoint termina.
        yield db
    finally:
        # Una vez que el endpoint terminó (o falló), se ejecuta el cierre.
        db.close()
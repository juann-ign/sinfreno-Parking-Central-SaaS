from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import dependencies
from app.services import stats_service
from app.models import db_models

router = APIRouter(prefix="/stats", tags=["Analytics"])

@router.get("/summary")
def read_dashboard_summary(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    # El multi-tenancy se aplica aquí usando la sucursal del usuario logueado
    return stats_service.get_dashboard_summary(db, current_user.sucursal_id)
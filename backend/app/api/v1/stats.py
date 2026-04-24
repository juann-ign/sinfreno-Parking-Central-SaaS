from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import dependencies
from app.services import stats_service
from app.models import schemas, db_models
from app.api.dependencies import RoleChecker


router = APIRouter(prefix="/stats", tags=["Analytics"])

@router.get("/summary", response_model=schemas.DashboardSummary)
def read_dashboard_summary(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    # El multi-tenancy se aplica aquí usando la sucursal del usuario logueado
    return stats_service.get_dashboard_summary(db, current_user.sucursal_id)

@router.get("/revenue-hourly", response_model=list[schemas.HourlyRevenue])
def read_hourly_revenue(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.get_current_user)
):
    """
    Retorna la recaudación agrupada por hora para el día actual.
    Ideal para gráficos de barras o líneas en el dashboard.
    """
    return stats_service.get_hourly_revenue(db, current_user.sucursal_id)
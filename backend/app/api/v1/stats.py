from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import dependencies
from app.services import stats_service
from app.models import schemas, db_models
from app.api.dependencies import RoleChecker


router = APIRouter(prefix="/stats", tags=["Analytics"])

# Solo admins pueden ver estadísticas
allow_admin = RoleChecker(["admin", "superAdmin"])

@router.get("/summary", response_model=schemas.DashboardSummary)
def read_dashboard_summary(
    db: Session = Depends(dependencies.get_db),
    # Aquí aplicamos la barrera
    current_user: db_models.Usuario = Depends(allow_admin)):
    
    # El multi-tenancy se aplica aquí usando la sucursal del usuario logueado
    return stats_service.get_dashboard_summary(db, current_user.sucursal_id)

@router.get("/revenue-hourly", response_model=list[schemas.HourlyRevenue])
def read_hourly_revenue(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(allow_admin)
):
    """
    Retorna la recaudación agrupada por hora para el día actual.
    Ideal para gráficos de barras o líneas en el dashboard.
    """
    return stats_service.get_hourly_revenue(db, current_user.sucursal_id)

@router.get("/peak-hour", response_model=schemas.PeakHour)
def read_peak_hour(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(allow_admin)
):
    return stats_service.get_peak_hour(db, current_user.sucursal_id)
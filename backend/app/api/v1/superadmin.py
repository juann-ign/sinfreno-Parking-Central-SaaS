from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api import dependencies
from app.models import schemas, db_models
from app.core import security

router = APIRouter(prefix="/superadmin", tags=["Torre de Control"])

@router.post("/provision")
def provision_tenant(
    data: schemas.TenantProvision,
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.RoleChecker(["SUPERADMIN"]))
):
    try:
        # 1. Verificar si el email o CUIT ya existen
        if db.query(db_models.Usuario).filter_by(email=data.email_admin).first():
            raise HTTPException(status_code=400, detail="El email ya está en uso")
        
        # 2. Crear Empresa (Tenant)
        nueva_empresa = db_models.Empresa(
            nombre=data.nombre_empresa,
            cuit=data.cuit,
            color_primario="#4f46e5" # Color por defecto
        )
        db.add(nueva_empresa)
        db.flush() # Genera ID sin confirmar commit

        # 3. Crear Sucursal Inicial (Sede Central)
        nueva_sucursal = db_models.Sucursal(
            nombre="Sede Central",
            empresa_id=nueva_empresa.id,
            tarifa_auto=1000,
            tarifa_moto=500,
            tarifa_camioneta=1500,
            tiempo_cortesia_min=10,
            fraccion_minutos=15
        )
        db.add(nueva_sucursal)
        db.flush()

        nueva_torre = db_models.Torre(
            numero=1,
            capacidad=50,
            sucursal_id=nueva_sucursal.id # <--- Atada a la nueva sucursal
        )
        db.add(nueva_torre)
        db.flush()

        # 4. Crear Usuario Admin Dueño
        nuevo_admin = db_models.Usuario(
            email=data.email_admin,
            password_hash=security.get_password_hash(data.password_admin),
            rol="ADMIN",
            permisos="ingreso,salida,ver_stats,ver_historial,config_sucursal",
            sucursal_id=nueva_sucursal.id
        )
        db.add(nuevo_admin)
        
        db.commit()
        return {"msg": "Tenant provisionado con éxito", "torre_id": nueva_torre.id}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Fallo en provisión: {str(e)}")

@router.get("/global-stats")
def get_global_stats(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.RoleChecker(["SUPERADMIN"]))
):
    return {
        "total_tenants": db.query(db_models.Empresa).count(),
        "total_sucursales": db.query(db_models.Sucursal).count(),
        "total_estadias": db.query(db_models.Estadia).count(),
        "recaudacion_total": db.query(func.sum(db_models.Estadia.monto)).scalar() or 0
    }
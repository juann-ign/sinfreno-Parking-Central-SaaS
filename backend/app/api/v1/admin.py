from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api import dependencies
from app.models import schemas, db_models
from app.core import security
    
router = APIRouter(prefix="/superadmin", tags=["SuperAdmin - Torre de Control"])

@router.post("/provision")
def provision_tenant(
    nombre_empresa: str,
    cuit: str,
    email_admin: str,
    password_admin: str,
    db: Session = Depends(dependencies.get_db),
    # Solo alguien con rol SUPERADMIN puede tocar esto
    current_user: db_models.Usuario = Depends(dependencies.RoleChecker(["SUPERADMIN"]))
):
    try:
        # 1. Crear Empresa
        nueva_empresa = db_models.Empresa(nombre=nombre_empresa, cuit=cuit)
        db.add(nueva_empresa)
        db.flush() # Para obtener el ID sin commitear aún

        # 2. Crear Sucursal Inicial
        nueva_sucursal = db_models.Sucursal(
            nombre="Sede Central", 
            empresa_id=nueva_empresa.id,
            tarifa_auto=1000, tarifa_moto=500, tarifa_camioneta=1500
        )
        db.add(nueva_sucursal)
        db.flush()

        # 3. Crear Usuario Admin de esa empresa
        nuevo_admin = db_models.Usuario(
            email=email_admin,
            password_hash=security.get_password_hash(password_admin),
            rol="ADMIN",
            permisos="ingreso,salida,ver_stats,ver_historial,config_sucursal",
            sucursal_id=nueva_sucursal.id
        )
        db.add(nuevo_admin)
        
        db.commit()
        return {"status": "Tenant creado exitosamente", "empresa_id": nueva_empresa.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error en provisión: {str(e)}")

@router.get("/stats-globales")
def get_global_stats(
    db: Session = Depends(dependencies.get_db),
    current_user: db_models.Usuario = Depends(dependencies.RoleChecker(["SUPERADMIN"]))
):
    # Esto es lo que vos ves como dueño del SaaS
    total_empresas = db.query(db_models.Empresa).count()
    total_estadias = db.query(db_models.Estadia).count()
    total_recaudado = db.query(func.sum(db_models.Estadia.monto)).scalar() or 0
    
    return {
        "tenants_activos": total_empresas,
        "operaciones_totales": total_estadias,
        "volumen_dinero_plataforma": total_recaudado
    }
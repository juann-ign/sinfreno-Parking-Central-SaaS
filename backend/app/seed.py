from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import db_models
from app.core.security import get_password_hash

def get_or_create_empresa(db, nombre, cuit):
    empresa = db.query(db_models.Empresa).filter_by(cuit=cuit).first()
    if not empresa:
        empresa = db_models.Empresa(nombre=nombre, cuit=cuit)
        db.add(empresa)
        db.commit()
        db.refresh(empresa)
    return empresa

def get_or_create_sucursal(db, nombre, empresa_id):
    sucursal = db.query(db_models.Sucursal).filter_by(nombre=nombre, empresa_id=empresa_id).first()
    if not sucursal:
        sucursal = db_models.Sucursal(
            nombre=nombre, 
            empresa_id=empresa_id,
            tarifa_auto=1000.0,
            tarifa_moto=500.0,
            tarifa_camioneta=1500.0,
            tiempo_cortesia_min=10,
            fraccion_minutos=15
        )
        db.add(sucursal)
        db.commit()
        db.refresh(sucursal)
    return sucursal

def seed():
    db = SessionLocal()
    try:
        print("--- Iniciando Sincronización de Datos ---")
        
        # 1. Empresas
        e1 = get_or_create_empresa(db, "Sinfreno Corp", "30-11111111-9")
        e2 = get_or_create_empresa(db, "Parking El Vecino", "30-99999998-9")

        s1 = get_or_create_sucursal(db, "Sede Central", e1.id)
        s2 = get_or_create_sucursal(db, "Sede Norte", e2.id)

        if not db.query(db_models.Usuario).filter_by(rol="SUPERADMIN").first():
            sa = db_models.Usuario(
                email="root@sinfreno.com",
                password_hash=get_password_hash("root123"),
                rol="SUPERADMIN",
                permisos="all",
                sucursal_id=None # SuperAdmin no pertenece a ninguna sede
            )
            db.add(sa)
            db.commit()
        # 3. Torres
        if not db.query(db_models.Torre).filter_by(sucursal_id=s1.id).first():
            db.add(db_models.Torre(numero=1, capacidad=50, sucursal_id=s1.id))
        if not db.query(db_models.Torre).filter_by(sucursal_id=s2.id).first():
            db.add(db_models.Torre(numero=2, capacidad=50, sucursal_id=s2.id))

        # 4. Usuarios (Admin y Operador)
        users_to_create = [
            {
                "email": "admin@sinfreno.com",
                "rol": "ADMIN",
                "permisos": "ingreso,salida,ver_stats,ver_historial,config_sucursal",
                "suc_id": s1.id,
                "pass": "admin123"
            },
            {
                "email": "vecino@test.com",
                "rol": "ADMIN",
                "permisos": "ingreso,salida,ver_stats,ver_historial,config_sucursal",
                "suc_id": s2.id,
                "pass": "admin123"
            },
            {
                "email": "empleado@sinfreno.com",
                "rol": "OPERADOR",
                "permisos": "ingreso,salida,ver_ocupacion",
                "suc_id": s1.id,
                "pass": "ope123"
            }
        ]

        for u_data in users_to_create:
            user = db.query(db_models.Usuario).filter_by(email=u_data["email"]).first()
            if not user:
                print(f"Creando usuario: {u_data['email']}...")
                user = db_models.Usuario(
                    email=u_data["email"],
                    password_hash=get_password_hash(u_data["pass"]),
                    rol=u_data["rol"],
                    permisos=u_data["permisos"],
                    sucursal_id=u_data["suc_id"]
                )
                db.add(user)

        db.commit()
        print("✅ PROCESO COMPLETADO: Usuarios y empresas listos.")

    except Exception as e:
        print(f"❌ Error en el seed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
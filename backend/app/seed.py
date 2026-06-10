from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import db_models
from app.core.security import get_password_hash

def seed():
    db = SessionLocal()
    try:
        # 1. Buscar o Crear Empresa (Tenant Principal)
        empresa = db.query(db_models.Empresa).filter_by(nombre="Sinfreno Corp").first()
        if not empresa:
            print("Creando empresa inicial...")
            empresa = db_models.Empresa(nombre="Sinfreno Corp", cuit="30-11111111-9")
            db.add(empresa)
            db.commit()
            db.refresh(empresa)

        # 2. Buscar o Crear Sucursal (Configuración de Negocio)
        sucursal = db.query(db_models.Sucursal).filter_by(nombre="Sede Central").first()
        if not sucursal:
            print("Creando sucursal inicial...")
            sucursal = db_models.Sucursal(
                nombre="Sede Central", 
                tarifa_hora=1500.0, 
                tiempo_cortesia_min=10, # NUEVO: 10 minutos de gracia
                empresa_id=empresa.id
            )
            db.add(sucursal)
            db.commit()
            db.refresh(sucursal)

        # 3. Buscar o Crear Torre
        torre = db.query(db_models.Torre).filter_by(numero=1, sucursal_id=sucursal.id).first()
        if not torre:
            print("Creando Torre 1...")
            torre = db_models.Torre(numero=1, capacidad=50, sucursal_id=sucursal.id)
            db.add(torre)

        # 4. CREACIÓN/ACTUALIZACIÓN DE USUARIO ADMINISTRADOR
        email_admin = "admin@sinfreno.com"
        admin = db.query(db_models.Usuario).filter_by(email=email_admin).first()
        
        hash_admin = get_password_hash("admin123")
        
        if not admin:
            print(f"Creando Admin: {email_admin}...")
            admin = db_models.Usuario(
                email=email_admin,
                password_hash=hash_admin,
                rol="ADMIN",
                # Permisos totales para el dueño
                permisos="ingreso,salida,ver_stats,ver_historial,config_sucursal",
                sucursal_id=sucursal.id
            )
            db.add(admin)
        else:
            print(f"Actualizando permisos y hash de Admin...")
            admin.password_hash = hash_admin
            admin.permisos = "ingreso,salida,ver_stats,ver_historial,config_sucursal"

        # 5. CREACIÓN/ACTUALIZACIÓN DE USUARIO OPERADOR
        email_ope = "empleado@sinfreno.com"
        operador = db.query(db_models.Usuario).filter_by(email=email_ope).first()
        
        hash_ope = get_password_hash("ope123")
        
        if not operador:
            print(f"Creando Operador: {email_ope}...")
            operador = db_models.Usuario(
                email=email_ope,
                password_hash=hash_ope,
                rol="OPERADOR",
                # Permisos limitados: solo flujo operativo
                permisos="ingreso,salida", 
                sucursal_id=sucursal.id
            )
            db.add(operador)
        else:
            print(f"Actualizando permisos y hash de Operador...")
            operador.password_hash = hash_ope
            operador.permisos = "ingreso,salida"

        db.commit()
        print("✅ PROCESO COMPLETADO: Base de datos sincronizada con modo SaaS Pro.")

    except Exception as e:
        print(f"❌ Error en el seed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
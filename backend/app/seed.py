from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import db_models
from app.core.security import get_password_hash

def seed():
    db = SessionLocal()
    try:
        # 1. Buscar o Crear Empresa
        empresa = db.query(db_models.Empresa).filter_by(nombre="Sinfreno Corp").first()
        if not empresa:
            empresa = db_models.Empresa(nombre="Sinfreno Corp", cuit="30-11111111-9")
            db.add(empresa)
            db.commit()
            db.refresh(empresa)

        # 2. Buscar o Crear Sucursal
        sucursal = db.query(db_models.Sucursal).filter_by(nombre="Sede Central").first()
        if not sucursal:
            sucursal = db_models.Sucursal(nombre="Sede Central", tarifa_hora=1500.0, empresa_id=empresa.id)
            db.add(sucursal)
            db.commit()
            db.refresh(sucursal)

        # 3. Buscar o Crear Torre
        torre = db.query(db_models.Torre).filter_by(numero=1).first()
        if not torre:
            torre = db_models.Torre(numero=1, capacidad=50, sucursal_id=sucursal.id)
            db.add(torre)

        # 4. LÓGICA DE USUARIO SEGURA (FORZADA)
        email_admin = "admin@sinfreno.com"
        usuario = db.query(db_models.Usuario).filter_by(email=email_admin).first()
        
        # Generamos el hash real
        nuevo_hash_seguro = get_password_hash("admin123")

        if not usuario:
            print(f"Creando usuario {email_admin} desde cero...")
            usuario = db_models.Usuario(
                email=email_admin,
                password_hash=nuevo_hash_seguro,
                rol="admin",
                sucursal_id=sucursal.id
            )
            db.add(usuario)
        else:
            print(f"Usuario {email_admin} ya existía. SOBREESCRIBIENDO hash viejo...")
            usuario.password_hash = nuevo_hash_seguro
        
        db.commit()
        print("✅ PROCESO COMPLETADO: La base de datos ahora tiene hashes válidos.")

    except Exception as e:
        print(f"❌ Error en el seed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
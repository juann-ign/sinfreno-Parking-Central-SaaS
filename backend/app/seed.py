from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models import db_models

def seed():
    db = SessionLocal()
    try:
        # 1. Crear Empresa
        empresa = db_models.Empresa(
            nombre="Sinfreno Corp", 
            cuit="30-11111111-9",
            logo_url="https://sinfreno.com/logo.png",
            color_primario="#ff5733"
        )
        db.add(empresa)
        db.commit()
        db.refresh(empresa)

        # 2. Crear Sucursal
        sucursal = db_models.Sucursal(
            nombre="Sede Central", 
            tarifa_hora=1500.0, 
            empresa_id=empresa.id
        )
        db.add(sucursal)
        db.commit()
        db.refresh(sucursal)

        # 3. Crear Torre
        torre = db_models.Torre(
            numero=1, 
            capacidad=50, 
            sucursal_id=sucursal.id
        )
        db.add(torre)

        # 4. Crear Usuario Operador
        usuario = db_models.Usuario(
            email="admin@sinfreno.com",
            password_hash="aca_iremos_con_argon2_luego",
            rol="admin",
            sucursal_id=sucursal.id
        )
        db.add(usuario)

        db.commit()
        print("✅ Base de datos poblada con éxito.")
    except Exception as e:
        print(f"❌ Error en el seed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
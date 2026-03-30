from app.core.database import SessionLocal, engine, Base
from app.models import db_models

def seed():
    # 1. Fuerza la creación de las tablas desde cero
    Base.metadata.drop_all(bind=engine) # Borra todo lo viejo
    Base.metadata.create_all(bind=engine) # Crea todo lo nuevo
    
    db = SessionLocal()
    
    try:
        # 2. Crear Empresa (Tenant)
        empresa = db_models.Empresa(nombre="Parking S.A.", cuit="30-12345678-9")
        db.add(empresa)
        db.commit()
        db.refresh(empresa)
        
        # 3. Crear Sucursal vinculada a la empresa
        sucursal = db_models.Sucursal(
            nombre="Sede Central Belgrano", 
            tarifa_hora=2000.0, 
            empresa_id=empresa.id
        )
        db.add(sucursal)
        db.commit()
        db.refresh(sucursal)
        
        # 4. Crear 5 torres para esa sucursal
        # Marcamos la Torre 3 con descuento (como tu script original)
        for i in range(1, 6):
            es_torre_3 = (i == 3)
            nueva_torre = db_models.Torre(
                numero=i, 
                capacidad=20, 
                aplica_descuento=es_torre_3, 
                sucursal_id=sucursal.id
            )
            db.add(nueva_torre)
        
        # 5. Crear un usuario Operador para probar
        operador = db_models.Usuario(
            email="operador@parking.com",
            password_hash="hashed_password_aqui",
            rol="operador",
            sucursal_id=sucursal.id
        )
        db.add(operador)
        
        db.commit()
        print("✅ Base de datos reseteada y poblada exitosamente.")
        
    except Exception as e:
        print(f"❌ Error durante el seed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
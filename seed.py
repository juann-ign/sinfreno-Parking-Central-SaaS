from database import SessionLocal
import models

def seed():
    db = SessionLocal()
    
    # 1. Crear una sucursal de prueba
    sucursal_central = models.Sucursal(nombre="Sede Central Belgrano", tarifa_hora=2000.0)
    db.add(sucursal_central)
    db.commit()
    db.refresh(sucursal_central)
    
    # 2. Crear 5 torres para esa sucursal
    for i in range(1, 6):
        nueva_torre = models.Torre(numero=i, sucursal_id=sucursal_central.id)
        db.add(nueva_torre)
    
    db.commit()
    print(f"Base de datos poblada: Sucursal '{sucursal_central.nombre}' creada con 5 torres.")
    db.close()

if __name__ == "__main__":
    seed()
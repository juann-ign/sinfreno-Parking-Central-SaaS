from sqlalchemy.orm import Session
from app.models import db_models
from fastapi import HTTPException 
import datetime
from math import ceil

def registrar_ingreso_vehiculo(db: Session, patente: str, torre_id: int, usuario_ingreso_id: int):
    # Lógica de ingreso (buscar vehiculo, validar torre, crear estadia)
    
    # 1. Validación crítica: ¿Existe la torre?
    torre = db.query(db_models.Torre).filter(db_models.Torre.id == torre_id).first()
    if not torre:
        raise HTTPException(status_code=404, detail=f"Torre con ID {torre_id} no existe en la base de datos.")
    
    patente_up = patente.upper()
    
    # 2. Buscar o crear vehículo
    vehiculo = db.query(db_models.Vehiculo).filter(db_models.Vehiculo.patente == patente_up).first()
    if not vehiculo:
        vehiculo = db_models.Vehiculo(patente=patente_up)
        db.add(vehiculo)
        db.commit()
        db.refresh(vehiculo)

    # 3. Verificar si el vehículo ya tiene una estadía activa 
    estadia_activa = db.query(db_models.Estadia).filter(db_models.Estadia.vehiculo_id == vehiculo.id, db_models.Estadia.estado == "ACTIVO").first()
    if estadia_activa:
        raise HTTPException(status_code=400, detail="El vehículo ya se encuentra en el estacionamiento.")


    nueva_estadia = db_models.Estadia(vehiculo_id=vehiculo.id, torre_id=torre_id, usuario_ingreso_id=usuario_ingreso_id, fecha_entrada=datetime.datetime.now(), monto=0.0, estado="ACTIVO")
    db.add(nueva_estadia)
    db.commit()
    db.refresh(nueva_estadia)
    return nueva_estadia


def registrar_salida_vehiculo(db: Session, patente: str, usuario_egreso_id: int):
    todas = db.query(db_models.Estadia).all()
    for e in todas:
        print(f"ID: {e.id}, Patente: {e.vehiculo.patente}, Estado: '{e.estado}'")

    # PASO A: Buscar el vehículo por su patente primero
    vehiculo = db.query(db_models.Vehiculo).filter(db_models.Vehiculo.patente == patente.strip().upper() # Limpiamos espacios y pasamos a mayúscula
    ).first()

    if not vehiculo:
        raise HTTPException(status_code=404, detail=f"Vehículo con patente {patente} no registrado.")

    # PASO B: Buscar la estadía activa para ESE vehículo específico
    estadia = db.query(db_models.Estadia).filter(db_models.Estadia.vehiculo_id == vehiculo.id, db_models.Estadia.estado == "ACTIVO"
    ).first()

    if not estadia:
        raise HTTPException(status_code=404, detail="No se encontró una estadía activa (ingreso) para este vehículo.")
    

    # 1. Buscar la estadía activa del vehículo.
    # Se necesita un join con la tabla Vehiculo para filtrar por patente
    estadia = db.query(db_models.Estadia).join(db_models.Vehiculo).filter(db_models.Vehiculo.patente == patente.upper(), db_models.Estadia.estado == "ACTIVO").first()

    if not estadia:
        raise HTTPException(status_code=404, detail="No se encontró una estadía activa para el vehículo con patente {patente}.")

    # 2. Registrar fecha de salida.
    fecha_salida = datetime.datetime.now()
    estadia.fecha_salida = fecha_salida

    # 3. Calcular monto a pagar.
    duracion = fecha_salida - estadia.fecha_entrada
    segundos_totales = duracion.total_seconds()
    
    # Se convierten a horas.ceil(1.1) = 2 horas (se cobra la hora empezada)
    horas_a_cobrar = ceil(segundos_totales/3600)
    if horas_a_cobrar == 0:
        horas_a_cobrar = 1  # Cobrar al menos una hora

    # Se obtiene la tarifa base de la sucursal a través de latorre
    tarifa_hora = estadia.torre.sucursal.tarifa_hora
    monto_final = horas_a_cobrar * tarifa_hora

    # 4. Aplicar descuento (si corresponde).
    if estadia.torre.aplica_descuento: 
        monto_final = monto_final * 0.85  # Aplica un 15% de descuento

    # 5. Actualizar la estadía con el monto final y marcarla como cerrada.
    estadia.monto = round(monto_final, 2)
    estadia.usuario_salida_id = usuario_egreso_id
    estadia.estado = "FINALIZADO"

    db.commit()
    db.refresh(estadia)
    return estadia



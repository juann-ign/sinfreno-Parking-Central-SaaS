import pytest
from datetime import datetime, timedelta, timezone
from math import ceil

# Simulamos la lógica que escribimos en parking_service.py para testearla aislada
def calcular_monto_test(minutos_totales, tarifa_base, minutos_gracia, tipo_vehiculo="AUTO", descuento_torre=0.0):
    monto_final = 0.0
    if minutos_totales > minutos_gracia:
        if minutos_totales <= 60:
            monto_final = tarifa_base
        else:
            minutos_adicionales = minutos_totales - 60
            fracciones_15 = ceil(minutos_adicionales / 15)
            monto_final = tarifa_base + (fracciones_15 * (tarifa_base / 4))

    # Aplicar factor de vehículo
    multiplicadores = {"AUTO": 1.0, "MOTO": 0.5, "CAMIONETA": 1.5}
    monto_final *= multiplicadores.get(tipo_vehiculo, 1.0)
    
    # Aplicar descuento
    monto_final = monto_final * (1 - descuento_torre)
    return round(monto_final, 2)

# --- CASOS DE PRUEBA ---

def test_tiempo_de_gracia():
    # Si la tarifa es 1000 y la gracia es 10, a los 5 min debe ser $0
    assert calcular_monto_test(minutos_totales=5, tarifa_base=1000, minutos_gracia=10) == 0.0

def test_primera_hora_completa():
    # A los 45 min debe cobrar la hora entera ($1000)
    assert calcular_monto_test(minutos_totales=45, tarifa_base=1000, minutos_gracia=10) == 1000.0

def test_fraccion_15_minutos():
    # 1 hora y 5 minutos = 1 hora + 1 fracción de 15 min
    # 1000 + (1000/4) = 1250
    assert calcular_monto_test(minutos_totales=65, tarifa_base=1000, minutos_gracia=10) == 1250.0

def test_varias_fracciones():
    # 1 hora y 35 minutos = 1 hora + 3 fracciones de 15 min (31-45 min adicionales)
    # 1000 + (250 * 3) = 1750
    assert calcular_monto_test(minutos_totales=95, tarifa_base=1000, minutos_gracia=10) == 1750.0

def test_moto_descuento_50_por_ciento():
    # Moto 1 hora completa = 1000 * 0.5 = 500
    assert calcular_monto_test(minutos_totales=40, tarifa_base=1000, minutos_gracia=10, tipo_vehiculo="MOTO") == 500.0

def test_descuento_de_torre():
    # Auto 1 hora ($1000) con 10% de descuento de la torre = 900
    assert calcular_monto_test(minutos_totales=40, tarifa_base=1000, minutos_gracia=10, descuento_torre=0.10) == 900.0
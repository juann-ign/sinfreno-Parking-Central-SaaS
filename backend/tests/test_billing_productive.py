"""Límites del motor que usa la cotización real, sin copiar la fórmula productiva."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from app.services.billing import calcular_cobro

ENTRY = datetime(2026, 11, 11, 10, 0, tzinfo=timezone.utc)
RULES = {"categoria": "AUTO", "tarifa_hora": "1000.00", "cortesia_minutos": 10,
         "fraccion_minutos": 15, "porcentaje_descuento": "0"}


@pytest.mark.parametrize("seconds,expected", [
    (0, "0.00"), (599, "0.00"), (600, "0.00"),
    (Decimal("600.000001"), "1000.00"), (3599, "1000.00"), (3600, "1000.00"),
    (Decimal("3600.000001"), "1250.00"), (3900, "1250.00"), (4500, "1250.00"),
    (Decimal("4500.000001"), "1500.00"), (5700, "1750.00"), (7200, "2000.00"),
])
def test_inclusive_grace_hour_and_fraction_boundaries(seconds, expected):
    cutoff = ENTRY + timedelta(microseconds=int(Decimal(str(seconds)) * 1_000_000))
    assert calcular_cobro(ENTRY, cutoff, RULES).monto == Decimal(expected)


def test_zero_grace_keeps_exact_entry_free_and_next_instant_bills_hour():
    rules = {**RULES, "cortesia_minutos": 0}
    assert calcular_cobro(ENTRY, ENTRY, rules).monto == Decimal("0.00")
    assert calcular_cobro(ENTRY, ENTRY + timedelta(microseconds=1), rules).monto == Decimal("1000.00")


@pytest.mark.parametrize("category,rate,expected", [
    ("AUTO", "1000.00", "1250.00"), ("MOTO", "500.00", "625.00"),
    ("CAMIONETA", "1500.00", "1875.00"),
])
def test_category_uses_its_snapshot_rate(category, rate, expected):
    rules = {**RULES, "categoria": category, "tarifa_hora": rate}
    assert calcular_cobro(ENTRY, ENTRY + timedelta(minutes=61), rules).monto == Decimal(expected)


@pytest.mark.parametrize("rate,discount,expected", [("10.05", "0.50", "5.03"), ("1000.00", "0.15", "850.00"), ("1000", "1", "0.00")])
def test_discount_and_final_half_up_rounding(rate, discount, expected):
    result = calcular_cobro(ENTRY, ENTRY + timedelta(minutes=20),
                            {**RULES, "tarifa_hora": rate, "porcentaje_descuento": discount})
    assert result.monto == Decimal(expected)
    assert result.explicacion["redondeo"] == "ROUND_HALF_UP"


def test_fraction_uses_exact_rate_before_rounding_total():
    result = calcular_cobro(ENTRY, ENTRY + timedelta(minutes=61),
                            {**RULES, "tarifa_hora": "1.00", "fraccion_minutos": 7})
    assert result.monto == Decimal("1.12")


def test_offset_equivalence_and_midnight_crossing():
    start = datetime(2026, 11, 11, 23, 30, tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))
    cutoff = datetime(2026, 11, 12, 3, 31, tzinfo=timezone.utc)
    assert calcular_cobro(start, cutoff, RULES).monto == Decimal("1250.00")


def test_dst_uses_absolute_instants_instead_of_wall_clock():
    zone = ZoneInfo("America/New_York")
    start = datetime(2026, 11, 1, 1, 30, tzinfo=zone, fold=0)
    cutoff = datetime(2026, 11, 1, 1, 31, tzinfo=zone, fold=1)
    assert calcular_cobro(start, cutoff, RULES).monto == Decimal("1250.00")


@pytest.mark.parametrize("patch", [
    {"categoria": ""}, {"categoria": "<b>MARCADOR_LOCAL</b>"},
    {"tarifa_hora": "NaN"}, {"tarifa_hora": "-1"}, {"porcentaje_descuento": "1.01"},
    {"fraccion_minutos": 0}, {"cortesia_minutos": -1},
])
def test_invalid_rules_are_rejected(patch):
    with pytest.raises(ValueError):
        calcular_cobro(ENTRY, ENTRY + timedelta(hours=1), {**RULES, **patch})


def test_naive_or_reversed_instants_require_review():
    with pytest.raises(ValueError):
        calcular_cobro(ENTRY.replace(tzinfo=None), ENTRY, RULES)
    with pytest.raises(ValueError):
        calcular_cobro(ENTRY, ENTRY - timedelta(microseconds=1), RULES)

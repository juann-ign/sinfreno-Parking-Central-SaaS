"""Motor productivo compartido por cotización y confirmación. ARS, HALF_UP a centavos."""
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP

CENT = Decimal("0.01")
MAX_MONEY = Decimal("999999999999.99")
CATEGORIES = frozenset({"AUTO", "MOTO", "CAMIONETA"})
PAYMENT_METHODS = ("EFECTIVO", "DEBITO", "CREDITO", "QR", "TRANSFERENCIA")


def money(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount < 0 or amount > MAX_MONEY:
            raise ValueError("Importe fuera de rango")
        return amount.quantize(CENT, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError):
        raise ValueError("Importe inválido") from None


def validate_rules(rules):
    try:
        category = rules["categoria"]
        rate = Decimal(str(rules["tarifa_hora"]))
        discount = Decimal(str(rules["porcentaje_descuento"]))
        grace = rules["cortesia_minutos"]
        fraction = rules["fraccion_minutos"]
        if (
            category not in CATEGORIES or not rate.is_finite() or rate <= 0 or rate > MAX_MONEY
            or not discount.is_finite() or not Decimal("0") <= discount <= Decimal("1")
            or isinstance(grace, bool) or not isinstance(grace, int) or grace < 0
            or isinstance(fraction, bool) or not isinstance(fraction, int) or fraction <= 0
        ):
            raise ValueError("Reglas de cobro inválidas")
        return {
            "categoria": category, "tarifa_hora": str(rate),
            "porcentaje_descuento": str(discount),
            "cortesia_minutos": grace, "fraccion_minutos": fraction,
        }
    except (KeyError, TypeError, InvalidOperation):
        raise ValueError("Reglas de cobro incompletas") from None


@dataclass(frozen=True)
class CalculoCobro:
    monto: Decimal
    explicacion: dict


def calcular_cobro(fecha_entrada: datetime, instante_corte: datetime, reglas: dict) -> CalculoCobro:
    """Cortesía inclusiva, primera hora completa, luego fracciones configuradas.

    Se usan instantes explícitos con offset. El redondeo monetario se aplica una
    sola vez al total después del descuento, sin truncar tarifas fraccionadas.
    """
    rules = validate_rules(reglas)
    if fecha_entrada.utcoffset() is None or instante_corte.utcoffset() is None:
        raise ValueError("El cálculo requiere instantes con zona horaria explícita")
    duration = instante_corte.astimezone(timezone.utc) - fecha_entrada.astimezone(timezone.utc)
    seconds = Decimal(duration.days * 86400 + duration.seconds) + Decimal(duration.microseconds) / Decimal("1000000")
    if seconds < 0:
        raise ValueError("El corte no puede ser anterior al ingreso")
    minutes = int((seconds / Decimal("60")).to_integral_value(rounding=ROUND_CEILING))
    rate = Decimal(rules["tarifa_hora"])
    fraction = rules["fraccion_minutos"]
    discount = Decimal(rules["porcentaje_descuento"])
    blocks = 0
    if seconds <= Decimal(rules["cortesia_minutos"] * 60):
        subtotal = Decimal("0")
    elif seconds <= Decimal("3600"):
        subtotal = rate
    else:
        blocks = int(((seconds - Decimal("3600")) / Decimal(fraction * 60)).to_integral_value(rounding=ROUND_CEILING))
        subtotal = rate + Decimal(blocks) * rate * Decimal(fraction) / Decimal("60")
    amount = money(subtotal * (Decimal("1") - discount))
    return CalculoCobro(amount, {
        **rules, "segundos_totales": str(seconds), "minutos_totales": minutes,
        "fracciones_adicionales": blocks, "monto_sin_descuento": str(money(subtotal)),
        "descuento_importe": str(money(subtotal * discount)), "redondeo": "ROUND_HALF_UP",
    })

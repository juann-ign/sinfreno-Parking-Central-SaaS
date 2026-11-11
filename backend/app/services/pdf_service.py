"""Comprobantes internos: HTML escapado y sin resolución de recursos externos."""

from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
from zoneinfo import ZoneInfo

from jinja2 import Environment, StrictUndefined
from xhtml2pdf import pisa
from xhtml2pdf.files import ResourceAccessPolicy


class PDFResourceBlocked(ValueError):
    """Un comprobante no puede abrir URLs, archivos ni recursos embebidos."""


TICKET_TEMPLATE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
@page { size: a6 portrait; margin: 10mm; }
body { font-family: Helvetica, Arial, sans-serif; color: #172033; font-size: 10pt; }
.brand { font-size: 18pt; color: #4338ca; font-weight: bold; }
h1 { font-size: 13pt; margin: 8pt 0; }
.muted { color: #566075; font-size: 8pt; }
.rule { border-bottom: 1pt solid #d8deeb; padding-bottom: 8pt; margin-bottom: 10pt; }
.plate { font-size: 20pt; font-weight: bold; }
td { padding: 4pt 0; vertical-align: top; }
.amount { font-size: 20pt; font-weight: bold; color: #4338ca; }
</style></head><body>
<div class="rule"><div class="brand">Sinfreno</div><div>{{ sucursal }}</div>
<h1>{{ titulo }}</h1><div class="muted">Operación #{{ id }} · {{ sector }}</div></div>
<div class="plate">{{ patente }}</div><div>{{ tipo }}</div>
<table width="100%"><tr><td>Ingreso</td><td>{{ entrada }}</td></tr>
{% if es_salida %}<tr><td>Egreso</td><td>{{ salida }}</td></tr>{% endif %}</table>
{% if es_salida %}<div class="rule"><div>Cobro registrado</div><div class="amount">ARS {{ monto }}</div>
<div>Medio registrado: {{ metodo_pago }}</div></div>
{% else %}<p class="muted">Este comprobante registra el ingreso. El importe se cotiza antes de confirmar el egreso.</p>{% endif %}
<p class="muted">Horarios nuevos: Argentina (UTC−03). Los horarios heredados sin zona confirmada se identifican expresamente.</p>
<p class="muted">Comprobante interno de estacionamiento. No acredita una transacción bancaria ni es una factura fiscal.</p>
</body></html>"""

_environment = Environment(autoescape=True, undefined=StrictUndefined)
# API inspected in the pinned xhtml2pdf 0.2.28, not assumed from an older release.
_resource_policy = ResourceAccessPolicy.server(
    base_dir=None, allow_remote=False, allow_remote_pdf_backgrounds=False,
    max_document_bytes=128_000, max_depth=40, max_resources=1,
    max_total_bytes=65_536, max_local_bytes=65_536, max_image_pixels=1,
    max_fetch_seconds=2, max_render_seconds=10,
)


def _fecha(utc_value, legacy_value):
    value = utc_value if utc_value is not None else legacy_value
    if value is None:
        return "Dato heredado no disponible"
    if value.tzinfo is None:
        return value.strftime("%d/%m/%Y %H:%M") + " (hora heredada sin zona confirmada)"
    local = value.astimezone(ZoneInfo("America/Argentina/Buenos_Aires"))
    return local.strftime("%d/%m/%Y %H:%M") + " (Argentina)"


def _ars(value):
    if value is None:
        return "Dato heredado no disponible"
    amount = Decimal(str(value))
    if not amount.is_finite() or amount < 0:
        raise ValueError("Importe inválido para comprobante")
    formatted = f"{amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):,.2f}"
    return formatted.replace(",", "_").replace(".", ",").replace("_", ".")


def render_ticket_html(estadia):
    es_salida = estadia.estado == "FINALIZADO"
    return _environment.from_string(TICKET_TEMPLATE).render(
        titulo="Comprobante de egreso" if es_salida else "Comprobante de ingreso",
        id=estadia.id, patente=estadia.patente, tipo=estadia.tipo_vehiculo,
        entrada=_fecha(getattr(estadia, "fecha_entrada_utc", None), estadia.fecha_entrada),
        salida=_fecha(getattr(estadia, "fecha_salida_utc", None), estadia.fecha_salida),
        monto=_ars(estadia.monto) if es_salida else "",
        metodo_pago=estadia.metodo_pago or "Sin dato heredado",
        sucursal=estadia.torre.sucursal.nombre, sector=f"Sector {estadia.torre.numero}",
        es_salida=es_salida,
    )


def render_pdf_html(html):
    """Trusted template only; a None callback result would enable default I/O."""
    blocked = False

    def deny_resource(_uri, _relative):
        nonlocal blocked
        blocked = True
        raise PDFResourceBlocked("Los comprobantes no admiten recursos externos")

    result = BytesIO()
    try:
        context = pisa.pisaDocument(BytesIO(html.encode("UTF-8")), result,
                                    encoding="UTF-8", link_callback=deny_resource,
                                    resource_policy=_resource_policy)
    except Exception:
        if blocked:
            raise PDFResourceBlocked("Recurso bloqueado en comprobante") from None
        raise
    if blocked:
        raise PDFResourceBlocked("Recurso bloqueado en comprobante")
    if context.err:
        raise ValueError("No se pudo generar el comprobante")
    return result.getvalue()


def generar_pdf_ticket(estadia):
    return render_pdf_html(render_ticket_html(estadia))

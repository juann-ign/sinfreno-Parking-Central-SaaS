from io import BytesIO
from xhtml2pdf import pisa
from jinja2 import Template

# Una plantilla HTML minimalista y profesional
TICKET_TEMPLATE = """
<html>
<head>
    <style>
        @page { size: a6 portrait; margin: 1cm; }
        body { font-family: Helvetica, Arial, sans-serif; color: #333; font-size: 10pt; }
        .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 20px; }
        .title { font-size: 18pt; font-weight: bold; color: #1e1b4b; }
        .info-row { margin-bottom: 8px; }
        .label { color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 8pt; }
        .value { float: right; font-weight: bold; }
        .total-box { background-color: #f1f5f9; padding: 15px; border-radius: 10px; text-align: center; margin-top: 20px; }
        .total-label { font-size: 8pt; color: #475569; text-transform: uppercase; }
        .total-amount { font-size: 20pt; color: #4f46e5; font-weight: bold; }
        .footer { text-align: center; font-size: 7pt; color: #94a3b8; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">SINFRENO</div>
        <div style="font-size: 8pt; color: #6366f1;">Smart Parking Solutions</div>
    </div>

    <div class="info-row"><span class="label">Patente:</span> <span class="value">{{ patente }}</span></div>
    <div class="info-row"><span class="label">Vehículo:</span> <span class="value">{{ tipo }}</span></div>
    <div class="info-row"><span class="label">Entrada:</span> <span class="value">{{ entrada }}</span></div>
    <div class="info-row"><span class="label">Salida:</span> <span class="value">{{ salida }}</span></div>
    <div class="info-row"><span class="label">Sucursal:</span> <span class="value">{{ sucursal }}</span></div>

    <div class="total-box">
        <div class="total-label">Total Cobrado</div>
        <div class="total-amount">${{ monto }}</div>
        <div style="font-size: 7pt; color: #94a3b8;">Pago vía: {{ metodo_pago }}</div>
    </div>

    <div class="footer">
        Gracias por su confianza.<br>
        Este es un comprobante digital de {{ sucursal }}.
    </div>
</body>
</html>
"""

def generar_pdf_ticket(estadia):
    data = {
        "patente": estadia.patente,
        "tipo": estadia.tipo_vehiculo,
        "entrada": estadia.fecha_entrada.strftime("%d/%m/%y %H:%M"),
        "salida": estadia.fecha_salida.strftime("%d/%m/%y %H:%M") if estadia.fecha_salida else "Activa",
        "monto": f"{estadia.monto:,.2f}",
        "metodo_pago": estadia.metodo_pago or "N/A",
        "sucursal": estadia.torre.sucursal.nombre,
        "color": estadia.torre.sucursal.empresa.color_primario or "#4f46e5",
    }
    
    template = Template(TICKET_TEMPLATE)
    html_out = template.render(data)
    
    result = BytesIO()
    pisa.pisaDocument(BytesIO(html_out.encode("UTF-8")), result)
    return result.getvalue()
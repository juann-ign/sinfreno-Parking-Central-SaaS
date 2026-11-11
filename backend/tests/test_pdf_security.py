"""Renderer real con marcadores inocuos; no prueba acceso a recursos ajenos."""

import base64
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from types import SimpleNamespace

import pytest

from app.services import pdf_service


def ticket(**overrides):
    values = dict(id=1, patente="ABC123", tipo_vehiculo="AUTO", estado="ACTIVO", monto=0,
                  fecha_entrada=datetime(2026, 11, 11, 12), fecha_salida=None,
                  fecha_entrada_utc=datetime(2026, 11, 11, 12, tzinfo=timezone.utc),
                  fecha_salida_utc=None, metodo_pago=None,
                  torre=SimpleNamespace(numero=7, sucursal=SimpleNamespace(nombre="Parking de prueba")))
    return SimpleNamespace(**(values | overrides))


def test_real_template_escapes_legacy_text_and_real_pdf_distinguishes_entry_exit():
    stay = ticket(tipo_vehiculo="<b>MARCADOR_LOCAL</b>", patente='<img src="file:///NO_EXISTE">',
                  torre=SimpleNamespace(numero=7, sucursal=SimpleNamespace(nombre="<b>Empresa</b>")))
    html = pdf_service.render_ticket_html(stay)
    assert "&lt;b&gt;MARCADOR_LOCAL&lt;/b&gt;" in html
    assert '<img src="file:' not in html
    assert "&lt;b&gt;Empresa&lt;/b&gt;" in html
    assert "Comprobante de ingreso" in html and "Cobro registrado" not in html
    assert pdf_service.generar_pdf_ticket(stay).startswith(b"%PDF")
    closed = ticket(estado="FINALIZADO", monto="1234.50", metodo_pago="QR",
                    fecha_salida=datetime(2026, 11, 11, 13),
                    fecha_salida_utc=datetime(2026, 11, 11, 13, tzinfo=timezone.utc))
    exit_html = pdf_service.render_ticket_html(closed)
    assert "Comprobante de egreso" in exit_html and "ARS 1.234,50" in exit_html
    assert pdf_service.generar_pdf_ticket(closed).startswith(b"%PDF")


def test_legacy_naive_time_is_labelled_without_utc_reinterpretation():
    html = pdf_service.render_ticket_html(ticket(fecha_entrada_utc=None))
    assert "11/11/2026 12:00 (hora heredada sin zona confirmada)" in html


def test_renderer_does_not_read_a_controlled_temporary_file(tmp_path, monkeypatch):
    marker = tmp_path / "innocent-marker.png"
    marker.write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCuoAAAAASUVORK5CYII="))
    import builtins
    original_open = builtins.open
    reads = []

    def observe_open(file, *args, **kwargs):
        if isinstance(file, (str, Path)) and str(file).removeprefix("file://") == str(marker):
            reads.append(str(file))
        return original_open(file, *args, **kwargs)

    monkeypatch.setattr(builtins, "open", observe_open)
    for uri in (str(marker), marker.as_uri()):
        with pytest.raises(pdf_service.PDFResourceBlocked):
            pdf_service.render_pdf_html(f'<html><body><img src="{uri}"></body></html>')
    assert reads == []


def test_renderer_does_not_request_a_controlled_local_http_resource():
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"innocent-local-marker")

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        uri = f"http://127.0.0.1:{server.server_port}/marker.png"
        with pytest.raises(pdf_service.PDFResourceBlocked):
            pdf_service.render_pdf_html(f'<html><body><img src="{uri}"></body></html>')
        with pytest.raises(pdf_service.PDFResourceBlocked):
            pdf_service.render_pdf_html(f'<html><head><style>@import url("{uri}");</style></head><body>Texto</body></html>')
        assert requests == []
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

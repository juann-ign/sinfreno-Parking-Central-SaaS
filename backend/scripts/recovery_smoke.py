"""Smoke HTTP real de SF-01, sólo contra una API local con seed descartable."""

import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/api/v1")
    args = parser.parse_args()
    url = urlsplit(args.base_url)
    if (
        url.scheme not in {"http", "https"}
        or url.hostname not in {"127.0.0.1", "localhost", "::1"}
        or url.username or url.password or url.query or url.fragment
    ):
        parser.error("--base-url debe ser una URL HTTP(S) de loopback sin credenciales")

    base = args.base_url.rstrip("/")
    # Sin proxies ni redirecciones: nunca reenviar las credenciales de demo.
    opener = build_opener(ProxyHandler({}), NoRedirects())

    def fetch(path, data=None, token=None):
        headers = {}
        if data is not None:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = Request(base + path, data=data, headers=headers)
        with opener.open(request, timeout=10) as response:
            result = json.load(response)
        print(f"OK {request.get_method()} {path}")
        return result

    login = fetch("/auth/login", data=urlencode({
        "username": "admin@sinfreno.com", "password": "admin123",
    }).encode())
    token = login.get("access_token")
    user = login.get("user_info", {})
    sucursal_id = (user.get("sucursal") or {}).get("id")
    if not token or user.get("rol") != "ADMIN" or not sucursal_id:
        raise RuntimeError("Login no devolvió el administrador ficticio con sucursal")

    config = fetch("/parking/config", token=token)
    if config.get("id") != sucursal_id or not config.get("torres"):
        raise RuntimeError("Configuración no coincide con la sucursal del seed")
    if not isinstance(fetch("/parking/activas", token=token), list):
        raise RuntimeError("La respuesta de estadías activas no es una lista")
    summary = fetch("/stats/summary", token=token)
    if not {"autos_adentro", "capacidad_disponible", "recaudacion_hoy"} <= summary.keys():
        raise RuntimeError("Resumen incompleto")
    print("APROBADO: login y lecturas autenticadas contra la API real; sin mutaciones.")


if __name__ == "__main__":
    try:
        main()
    except HTTPError as exc:
        print(f"FALLÓ: HTTP {exc.code}. Revisar logs del backend.", file=sys.stderr)
        sys.exit(1)
    except (URLError, RuntimeError, ValueError, KeyError, TypeError) as exc:
        print(f"FALLÓ: {exc}", file=sys.stderr)
        sys.exit(1)

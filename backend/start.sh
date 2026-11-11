#!/bin/sh

# Detener el script si hay algún error
set -e

echo "--- 1. Aplicando Migraciones de Base de Datos ---"
alembic upgrade head

echo "--- 2. Iniciando FastAPI; el seed demo requiere un comando explícito ---"
exec uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-127.0.0.1}"

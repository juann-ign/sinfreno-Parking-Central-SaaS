# Detener el script si hay algún error
set -e

echo "--- 1. Aplicando Migraciones de Base de Datos ---"
alembic upgrade head

echo "--- 2. Cargando datos iniciales (Seeding) ---"
python -m app.seed

echo "--- 3. Iniciando FastAPI con Uvicorn ---"
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
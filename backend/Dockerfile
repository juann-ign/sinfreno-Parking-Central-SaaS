FROM python:3.11-slim

WORKDIR /app

# Evita que Python genere archivos .pyc y permite ver logs en tiempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Seteamos el PYTHONPATH para que Python encuentre la carpeta 'app'
ENV PYTHONPATH=/app

# Instalar dependencias del sistema para PostgreSQL
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

ARG INSTALL_DEV=false
COPY requirements.txt requirements-dev.txt ./
COPY requirements-runtime.lock requirements-dev.lock ./
RUN if [ "$INSTALL_DEV" = "true" ]; then \
      pip install --no-cache-dir -r requirements-dev.txt; \
    else pip install --no-cache-dir -r requirements.txt; fi

COPY . .

# Normalizar CRLF al construir desde Windows y habilitar el script en Linux.
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh \
    && useradd --system --uid 10001 --create-home sinfreno \
    && chown -R sinfreno:sinfreno /app

USER sinfreno

CMD ["./start.sh"]

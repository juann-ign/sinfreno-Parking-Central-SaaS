import logging
import sys
import os

# Definimos el formato: Timestamp | Nivel de Error | Nombre del Archivo | Mensaje
# Ejemplo: 2023-10-27 10:00:00 | INFO | parking_service | Vehículo ABC1234 ingresado.
LOG_FORMAT = "%(asctime)s | %(levelname)s | %(module)s | %(message)s"

def setup_logging():
    """
    Configura el sistema de logs global de la aplicación.
    Se encarga de decidir a dónde van los mensajes y con qué formato.
    """
    # Creamos el objeto principal de log
    logger = logging.getLogger("sinfreno")
    logger.setLevel(logging.INFO) # Nivel mínimo de captura

    formatter = logging.Formatter(LOG_FORMAT)

    # 1. Handler para Terminal (Consola)
    # Permite que veas los logs en tiempo real mientras corres Docker
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 2. Handler para Archivo (Auditoría)
    # Escribe en un archivo físico. 'a' significa 'append' (agrega al final)
    file_handler = logging.FileHandler("app_audit.log", mode='a', encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger

# Creamos la instancia para importar en otros archivos
logger = setup_logging()
# 🏎️ Sinfreno | Smart Parking SaaS
**"Gestión de flujos vehiculares sin fricción, sin demoras, sinfreno."**

Sinfreno es una plataforma integral de gestión de estacionamientos diseñada bajo una arquitectura **Multi-tenant** y **White-label**. Permite a dueños de parkings gestionar múltiples sedes, monitorear ocupación en tiempo real y automatizar la facturación con un motor de reglas flexible.

## 🚀 El Diferencial "Sinfreno"
A diferencia de los sistemas tradicionales, Sinfreno ofrece:
- **Identidad Corporativa Adaptable:** Cada empresa cliente (Tenant) puede personalizar la interfaz con su logo y paleta de colores.
- **Arquitectura de Alta Disponibilidad:** Backend construido con FastAPI y PostgreSQL, listo para ser desplegado en la nube (AWS/Azure).
- **Control de Auditoría Total:** Registro detallado de qué operador realizó cada ingreso y egreso.

## 🛠️ Stack Tecnológico (Nivel Ingeniería)
- **Lenguaje:** Python 3.11+
- **Framework:** FastAPI (Asincrónico)
- **Base de Datos:** PostgreSQL + SQLAlchemy 2.0 (Mapping Imperativo/Declarativo)
- **Infraestructura:** Docker & Docker Compose
- **Seguridad:** JWT (Stateless Auth) y Encriptación Argon2

## 🗂️ Estructura del Proyecto

sinfreno/
├── backend
    ├── app/                     # Paquete principal de la aplicación
    │   ├── __init__.py         # Inicialización del paquete
        ├── seed.py
    │   ├── api/                # Endpoints de la API
    │   │   ├── __init__.py
    │   │   ├── dependencies.py # Dependencias de la API
    │   │   └── v1/            # API v1 endpoints
    │   │       ├── __init__.py
                ├── auth.py
                ├── parking.py
                ├── stats.py
    │   │       ├── chat.py     # Endpoints de chat
    │   │       └── health.py   # Health check endpoints
    │   ├── config/             # Configuración
    │   │   ├── __init__.py
    │   │   └── settings.py    # Settings de la aplicación
    │   ├── core/               # Componentes core
    │   │   ├── __init__.py
    |   |   ├── config.py
    |   |   ├── database.py
    |   |   ├── exceptions.py
    |   |   ├── timezone_utils.py
    |   |   ├── websocket_manager.py
    │   │   ├── logger.py      # Configuración de logging
    │   │   └── security.py    # Utilidades de seguridad
    │   ├── models/             # Modelos de datos
    │   │   ├── __init__.py
            ├── db_models.py
    │   │   └── schemas.py      # Modelos Pydantic
    │   └── services/           # Lógica de negocio
    │       ├── __init__.py
            ├── parking_service.py
    │       └── stats_service.py  # Servicio de IA
        ├── stats_service.py
        
    ├── alembic/
        ├── versions/
            ├── ...
        ├── env.py              # Configuración Docker
        ├── script.py.mako
        ├── README.md
    ├── main.py              # Configuración Docker
    ├── requirements.txt         # Dependencias (para pip)
    ├── pyproject.toml          # Configuración del proyecto (para uv)
    ├── alembic.ini              # Configuración Docker
    ├── app_audit.log              # Configuración Docker
    ├── Dockerfile              # Configuración Docker
    ├── start.sh              # Configuración Docker
├── docker-compose.yml      # Orquestación Docker Compose
├── .dockerignore           # Archivos ignorados por Docker
├── .gitignore             # Archivos ignorados por Git
├── env.example            # Plantilla de variables de entorno
└── README.md              # Documentación principal

## 🛠️ Instalación con un solo comando
```bash
docker-compose up --build
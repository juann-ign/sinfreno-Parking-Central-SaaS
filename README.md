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

```
sinfreno/
├── backend
|   ├── app/                     # Paquete principal de la aplicación
|   │   ├── __init__.py         # Inicialización del paquete
|   |   ├── seed.py
|   │   ├── api/                # Endpoints de la API
|   │   │   ├── __init__.py
|   │   │   ├── dependencies.py # Dependencias de la API
|   │   │   └── v1/            # API v1 endpoints
|   │   │       ├── __init__.py
|   |   |       ├── auth.py
|   |   |       ├── parking.py
|   |   |       ├── stats.py
|   │   │       ├── chat.py     # Endpoints de chat
|   │   │       └── health.py   # Health check endpoints
|   │   ├── config/             # Configuración
|   │   │   ├── __init__.py
|   │   │   └── settings.py    # Settings de la aplicación
|   │   ├── core/               # Componentes core
|   │   │   ├── __init__.py
|   |   |   ├── config.py
|   |   |   ├── database.py
|   |   |   ├── exceptions.py
|   |   |   ├── timezone_utils.py
|   |   |   ├── websocket_manager.py
|   │   │   ├── logger.py      # Configuración de logging
|   │   │   └── security.py    # Utilidades de seguridad
|   │   ├── models/             # Modelos de datos
|   │   │   ├── __init__.py
|   |   |   ├── db_models.py
|   │   │   └── schemas.py      # Modelos Pydantic
|   │   └── services/           # Lógica de negocio
|   │       ├── __init__.py
|   |       ├── parking_service.py
|   │       └── stats_service.py  # Servicio de IA
|   ├── alembic/
|   |    ├── versions/
|   |   |   └── ...
|   |   ├── env.py              # Configuración Docker
|   |   ├── script.py.mako
|   |   └── README.md
|   ├── main.py                 # Configuración Docker
|   ├── alembic.ini              # Configuración Docker
|   ├── app_audit.log              # Configuración Docker
|   ├── Dockerfile              # Configuración Docker
|   ├── pyproject.toml          # Configuración del proyecto (para uv)
|   ├── requirements.txt         # Dependencias (para pip)
|   └── start.sh              # Configuración Docker
├── frontend/
|   └── ...
├── docker-compose.yml      # Orquestación Docker Compose
├── .dockerignore           # Archivos ignorados por Docker
├── .gitignore             # Archivos ignorados por Git
├── env.example            # Plantilla de variables de entorno
└── README.md              # Documentación principal
```

---

## Recuperación de accesos (SF-02A)

La revisión actual está en [SF-02A](docs/recovery/02a-accesos.md), con autorización
HTTP/PDF/WebSocket y pruebas contra PostgreSQL. Usa recursos separados de SF-01:

```powershell
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml up -d --build --wait --wait-timeout 120
```

Aplicación: http://127.0.0.1:15174. El informe contiene la preparación explícita
de datos sintéticos, cuentas, pruebas y limitaciones. No modifica la demo SF-01.

## 🛠️ Entorno local de recuperación (SF-01)

Desde PowerShell, con Docker Desktop iniciado:

```powershell
docker --context desktop-linux compose -p sinfreno-sf01-20261110 -f docker-compose.recovery.yml up -d --build --wait --wait-timeout 120
```

Abrir http://127.0.0.1:15173. Cuenta ficticia de esta base descartable: `admin@sinfreno.com` / `admin123`.

El [reporte SF-01](docs/recovery/01-entorno.md) documenta las verificaciones, recursos aislados, instrucciones de desarrollo y limitaciones. El Compose original y cualquier base anterior se conservan. La revisión de seguridad, cobro y caja sigue pendiente antes de publicar.

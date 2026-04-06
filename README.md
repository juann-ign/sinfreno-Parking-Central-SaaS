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

## 🛠️ Instalación con un solo comando
```bash
docker-compose up --build
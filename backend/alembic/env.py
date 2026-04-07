import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# 1. Importamos la Base y los modelos para que Alembic los "vea"
from app.models.db_models import Base

# Este es el objeto de configuración de Alembic
config = context.config

# Interpreta el archivo de configuración para el logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 2. Definimos los metadatos de nuestros modelos
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Ejecutar migraciones en modo 'offline'."""
    url = os.getenv("DATABASE_URL")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Ejecutar migraciones en modo 'online' (conectado a la DB)."""
    
    # 3. LEER LA URL DESDE EL ENTORNO (DOCKER)
    # Esto pisa cualquier cosa que diga el archivo alembic.ini
    db_url = os.getenv("DATABASE_URL")
    
    # Si por alguna razón no está la variable, lanzamos error claro
    if not db_url:
        raise Exception("DATABASE_URL no encontrada en el entorno.")

    # Seteamos la URL en la configuración de SQLAlchemy
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = db_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
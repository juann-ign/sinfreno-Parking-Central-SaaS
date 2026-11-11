"""Create the private global owner of an empty installation, explicitly and interactively."""

import argparse
import getpass
import sys

from email_validator import validate_email
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.db_models import Usuario


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--confirm-database", required=True)
    parser.add_argument("--confirm-new-install", action="store_true", required=True)
    args = parser.parse_args()
    try:
        database = make_url(settings.DATABASE_URL)
        if database.get_backend_name() != "postgresql" or args.confirm_database != database.database:
            raise ValueError("Database confirmation does not match")
        if not sys.stdin.isatty():
            raise ValueError("An interactive terminal is required")
        email = validate_email(args.email, check_deliverability=False).normalized
        password = getpass.getpass("Contraseña privada del propietario (mínimo 14 caracteres): ")
        if len(password) < 14 or password != getpass.getpass("Repetir contraseña: "):
            raise ValueError("Invalid password confirmation")
        with SessionLocal.begin() as db:
            db.execute(text("SELECT pg_advisory_xact_lock(735906152316)"))
            if db.query(Usuario).count():
                raise ValueError("This installation already has users")
            db.add(Usuario(email=email, password_hash=get_password_hash(password),
                           rol="SUPERADMIN", permisos="", sucursal_id=None, activo=True))
        print("Propietario global privado creado. Ingresar por HTTPS y aprovisionar la primera sucursal.")
    except Exception:
        print("No se creó el propietario. Revisar confirmación de base, instalación vacía y datos de acceso.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

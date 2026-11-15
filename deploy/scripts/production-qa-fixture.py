"""Explicit fixture helper, outside the production image and startup path.

The runner pipes this file into a one-off runtime-image container on its NEW
private QA network. It never truncates, resets, seeds or targets a real install.
"""

import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models import db_models as m


def run():
    nonce = os.environ.get("PRODUCTION_QA_RUN", "")
    project = os.environ.get("PRODUCTION_QA_PROJECT", "")
    url = make_url(settings.DATABASE_URL)
    if (
        not re.fullmatch(r"[0-9a-f]{24}", nonce)
        or not re.fullmatch(r"sinfreno-production-qa-[0-9]+-" + nonce, project)
        or os.environ.get("PRODUCTION_QA_CONFIRM") != nonce
        or url.get_backend_name() != "postgresql"
        or url.host != "db"
        or url.database != "production_qa_disposable"
        or url.username != "production_qa"
        or settings.APP_ENV != "production"
        or settings.TELEGRAM_TOKEN
        or settings.TELEGRAM_CHAT_ID
    ):
        raise RuntimeError("Fixture target is not this invocation's isolated production QA database")
    marker = "sinfreno-production-qa:" + nonce
    action = sys.argv[1]
    with SessionLocal.begin() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(735906152317)"))
        actual_marker = db.execute(text(
            "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = current_database()"
        )).scalar_one()
        if actual_marker != marker:
            raise RuntimeError("Database invocation marker does not match")
        if action == "create":
            if any(db.query(model).count() for model in (m.Empresa, m.Usuario, m.Estadia, m.CierreCaja)):
                raise RuntimeError("Fixture creation requires an empty new QA installation")
            company = m.Empresa(nombre="Synthetic production QA", cuit=marker)
            db.add(company)
            db.flush()
            branch = m.Sucursal(nombre="Synthetic QA branch", empresa_id=company.id,
                                tarifa_auto=Decimal("1000.00"), tarifa_moto=Decimal("500.00"),
                                tarifa_camioneta=Decimal("1500.00"), tiempo_cortesia_min=10,
                                fraccion_minutos=15)
            db.add(branch)
            db.flush()
            tower = m.Torre(numero=1, capacidad=10, sucursal_id=branch.id, porcentaje_descuento=0)
            db.add(tower)
            password = os.environ["PRODUCTION_QA_PASSWORD"]
            if len(password) < 32:
                raise RuntimeError("Missing invocation-only fixture password")
            hashed = get_password_hash(password)
            for email, role, permissions in (
                ("admin@production-qa.example.com", "ADMIN", ""),
                ("operator@production-qa.example.com", "OPERADOR", "ingreso,salida,ver_ocupacion"),
            ):
                db.add(m.Usuario(email=email, password_hash=hashed, rol=role, permisos=permissions,
                                 sucursal_id=branch.id, activo=True))
            db.flush()
            result = {"branch": branch.id, "tower": tower.id}
        else:
            company = db.query(m.Empresa).filter_by(cuit=marker).one()
            branch = db.query(m.Sucursal).filter_by(empresa_id=company.id).one()
            stay = db.get(m.Estadia, int(sys.argv[2]))
            if stay is None or stay.sucursal_id != branch.id or stay.patente != "PRODQA1":
                raise RuntimeError("Stay does not belong to this invocation's synthetic branch")
            if action == "age":
                if stay.estado != "ACTIVO" or db.query(m.Cotizacion).filter_by(estadia_id=stay.id).count():
                    raise RuntimeError("Only a new unquoted synthetic entry can be aged")
                # Explicit fixture timestamp only; the live quote/confirmation clock is real.
                start = datetime.now(timezone.utc) - timedelta(minutes=20)
                stay.fecha_entrada_utc = start
                stay.fecha_entrada = start.replace(tzinfo=None)
                result = {"syntheticEntryAged": True}
            elif action == "verify":
                assert stay.estado == "FINALIZADO" and Decimal(stay.monto) == Decimal("1000.00")
                assert db.query(m.Estadia).count() == 1
                assert db.query(m.Auditoria).filter_by(accion="COBRO_SALIDA", sucursal_id=branch.id).count() == 1
                assert db.query(m.OperacionIdempotente).filter_by(tipo="SALIDA", sucursal_id=branch.id).count() == 1
                result = {"singleStay": True, "singlePaymentAudit": True, "singleConfirmation": True}
            else:
                raise RuntimeError("Unknown fixture action")
    print(json.dumps(result))


if __name__ == "__main__":
    try:
        run()
    except Exception:
        # Database exceptions may contain credentials or bound parameters.
        print("Production QA fixture failed its target, empty-install or synthetic-data checks.", file=sys.stderr)
        sys.exit(1)

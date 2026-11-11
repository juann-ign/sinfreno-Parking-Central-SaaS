"""Explicit local demo identities; normal server startup never calls this module."""

import argparse
import sys
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.database import Base, SessionLocal
from app.core.security import get_password_hash
from app.models import db_models as m

DEMO_PASSWORD = "Sinfreno-demo-local-2026"


def require_demo_database(confirmation):
    database = make_url(settings.DATABASE_URL)
    if (
        settings.APP_ENV not in {"development", "test"}
        or database.get_backend_name() != "postgresql"
        or database.database != "release_disposable"
        or confirmation != database.database
        or database.username != "release_demo"
        or database.host not in {"db", "127.0.0.1", "localhost"}
        or settings.TELEGRAM_TOKEN or settings.TELEGRAM_CHAT_ID
    ):
        raise RuntimeError("Seed prohibido: requiere la base descartable release_disposable, confirmación explícita y Telegram desactivado")


def _seed_identities(confirmation, reset=False):
    require_demo_database(confirmation)
    with SessionLocal.begin() as db:
        if reset:
            # Model metadata supplies table names, never user-controlled SQL.
            tables = ", ".join(f'"{table.name}"' for table in Base.metadata.tables.values())
            db.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        if db.query(m.Usuario).filter_by(email="admin@release.example.com").first():
            print("Demo ya preparada; no se modificaron cuentas existentes. Usar --reset sólo para reiniciar esta base descartable.")
            return
        if db.query(m.Empresa).count() or db.query(m.Usuario).count():
            raise RuntimeError("Seed rechazado: la base contiene datos ajenos al dataset de demo")

        company = m.Empresa(nombre="Sinfreno Demo", cuit="DEMO-NO-FISCAL", color_primario="#4f46e5")
        db.add(company)
        db.flush()
        branches = [m.Sucursal(
            nombre=name, empresa_id=company.id,
            tarifa_auto=Decimal("1000.00"), tarifa_moto=Decimal("500.00"),
            tarifa_camioneta=Decimal("1500.00"), tiempo_cortesia_min=10, fraccion_minutos=15,
        ) for name in ("Demo Centro", "Demo Norte")]
        db.add_all(branches)
        db.flush()
        db.add_all([m.Torre(numero=number, capacidad=25, sucursal_id=branch.id, porcentaje_descuento=0)
                    for branch in branches for number in (1, 2)])
        password_hash = get_password_hash(DEMO_PASSWORD)
        specs = [
            ("admin@release.example.com", "ADMIN", branches[0].id, ""),
            ("operador@release.example.com", "OPERADOR", branches[0].id, "ingreso,salida,ver_ocupacion"),
            ("admin.norte@release.example.com", "ADMIN", branches[1].id, ""),
        ]
        db.add_all([m.Usuario(email=email, rol=role, sucursal_id=branch_id,
                             permisos=permissions, password_hash=password_hash)
                    for email, role, branch_id, permissions in specs])
    print("Demo local preparada en una transacción: 1 empresa, 2 sucursales, 4 sectores y 3 cuentas ficticias. Sin SUPERADMIN.")


@contextmanager
def demo_clock(instant):
    """Synthetic UTC clock only in this explicit CLI process, never in the API."""
    original = m.utc_now
    m.utc_now = lambda: instant
    try:
        yield
    finally:
        m.utc_now = original


def _seed_operations():
    from app.services import caja_service, parking_service

    with SessionLocal() as db:
        if db.query(m.Auditoria).filter_by(accion="DEMO_DATASET_PREPARADO").first():
            print("Operaciones demo ya preparadas; no se duplicaron cobros ni turnos.")
            return
        admin = db.query(m.Usuario).filter_by(email="admin@release.example.com").one()
        operator = db.query(m.Usuario).filter_by(email="operador@release.example.com").one()
        north = db.query(m.Usuario).filter_by(email="admin.norte@release.example.com").one()
        branch_id, admin_id, operator_id, north_branch, north_id = (
            admin.sucursal_id, admin.id, operator.id, north.sucursal_id, north.id,
        )
        sectors = db.query(m.Torre).filter_by(sucursal_id=branch_id).order_by(m.Torre.numero).all()
        sector_ids = [sector.id for sector in sectors]
        north_sector = db.query(m.Torre).filter_by(sucursal_id=north_branch).order_by(m.Torre.numero).first().id
        now = datetime.now(timezone.utc).replace(microsecond=0)

        with demo_clock(now - timedelta(hours=4)):
            historical, _ = caja_service.abrir_caja(db, branch_id, admin_id, "demo-historical-open", "Turno sintético para recorrido de demo")
        # Repeated runs resume the exact original timeline and idempotency keys.
        anchor = db.get(m.CierreCaja, historical["id"]).fecha_apertura_utc + timedelta(hours=4)
        historical_id = historical["id"]
        with demo_clock(anchor - timedelta(minutes=230)):
            qr_stay, _ = parking_service.registrar_ingreso_vehiculo(
                db, "DEMO002", sector_ids[1], operator_id, branch_id, "AUTO", historical_id, "demo-qr-entry")
        with demo_clock(anchor - timedelta(minutes=210)):
            cash_stay, _ = parking_service.registrar_ingreso_vehiculo(
                db, "DEMO001", sector_ids[0], operator_id, branch_id, "AUTO", historical_id, "demo-cash-entry")

        for stay, method, minutes_before, key in (
            (cash_stay, "EFECTIVO", 165, "demo-cash-checkout"),
            (qr_stay, "QR", 110, "demo-qr-checkout"),
        ):
            previous = db.query(m.OperacionIdempotente).filter_by(
                sucursal_id=branch_id, usuario_id=operator_id, tipo="SALIDA", clave=key,
            ).first()
            if previous is not None:
                continue
            with demo_clock(anchor - timedelta(minutes=minutes_before)):
                quote = parking_service.cotizar_salida(db, stay["id"], branch_id, operator_id)
                parking_service.registrar_salida_vehiculo(
                    db, stay["id"], operator_id, branch_id, quote["id"], historical_id, method, key)
        with demo_clock(anchor - timedelta(minutes=100)):
            closed, _ = caja_service.cerrar_caja(
                db, branch_id, admin_id, historical_id, Decimal("1000.00"),
                "Demo: ARS 1000 efectivo + ARS 2000 QR; fondo cero", "demo-historical-close")
        if Decimal(closed["recaudacion_total"]) != Decimal("3000.00") or Decimal(closed["diferencia"]) != 0:
            raise RuntimeError("El motor productivo no produjo el escenario mixto esperado")
        with demo_clock(anchor - timedelta(minutes=90)):
            current, _ = caja_service.abrir_caja(db, branch_id, admin_id, "demo-current-open", "Turno abierto de demo; fondo inicial cero")
        for plate, category, minutes_before, sector_id in (
            ("DEMO003", "AUTO", 65, sector_ids[0]),
            ("DEMO004", "MOTO", 35, sector_ids[1]),
            ("DEMO005", "CAMIONETA", 8, sector_ids[0]),
        ):
            with demo_clock(anchor - timedelta(minutes=minutes_before)):
                parking_service.registrar_ingreso_vehiculo(
                    db, plate, sector_id, operator_id, branch_id, category, current["id"], "demo-entry-" + plate)
        with demo_clock(anchor - timedelta(minutes=60)):
            north_cash, _ = caja_service.abrir_caja(db, north_branch, north_id, "demo-north-open", "Sucursal independiente de demo")
        with demo_clock(anchor - timedelta(minutes=20)):
            parking_service.registrar_ingreso_vehiculo(
                db, "NORTE01", north_sector, north_id, north_branch, "MOTO", north_cash["id"], "demo-north-entry")
        db.add(m.Auditoria(usuario_id=admin_id, sucursal_id=branch_id, accion="DEMO_DATASET_PREPARADO",
                           detalles="Dataset ficticio creado con servicios productivos y reloj UTC controlado sólo en CLI; auditoría/idempotencia registradas al sembrar"))
        db.commit()
    print("Operaciones reales del motor sobre datos ficticios: 2 cobros, turno cerrado ARS 3000 / efectivo esperado ARS 1000 / diferencia cero, y 4 estadías activas.")


def seed(confirmation, reset=False):
    _seed_identities(confirmation, reset=reset)
    _seed_operations()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-disposable", required=True, metavar="DATABASE")
    parser.add_argument("--reset", action="store_true", help="Reinicia sólo la base descartable confirmada")
    args = parser.parse_args()
    try:
        seed(args.confirm_disposable, reset=args.reset)
    except Exception:
        # Exception text may contain connection details or statement parameters.
        print("Falló el seed; la transacción fue revertida. Revisar configuración y migraciones sin publicar secretos.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

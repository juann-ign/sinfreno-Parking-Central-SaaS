"""Fixtures de regresión de accesos, sólo en el PostgreSQL NUEVO de release."""

import os
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models import db_models as m

PASSWORD = "sf02a-demo-only"


def require_disposable_database():
    url = make_url(settings.DATABASE_URL)
    if (
        os.environ.get("RELEASE_ALLOW_RESET") != "1"
        or url.get_backend_name() != "postgresql"
        or url.database != "release_disposable"
        or url.username != "release_demo"
        or url.host not in {"db", "127.0.0.1", "localhost"}
        or settings.APP_ENV not in {"test", "development"}
    ):
        raise RuntimeError("Reset prohibido: requiere PostgreSQL release_disposable/release_demo local, APP_ENV de prueba y RELEASE_ALLOW_RESET=1")
    if settings.TELEGRAM_TOKEN or settings.TELEGRAM_CHAT_ID:
        raise RuntimeError("Las pruebas requieren Telegram desactivado")


@lru_cache(maxsize=1)
def demo_hash():
    return get_password_hash(PASSWORD)


def reset_and_seed():
    require_disposable_database()
    with SessionLocal() as db:
        names = [db.bind.dialect.identifier_preparer.quote(table.name) for table in m.Base.metadata.sorted_tables]
        db.execute(text("TRUNCATE " + ", ".join(names) + " RESTART IDENTITY CASCADE"))
        empresas = [m.Empresa(nombre="SF02A Alpha", cuit="SF02A-ALPHA"), m.Empresa(nombre="SF02A Beta", cuit="SF02A-BETA")]
        db.add_all(empresas)
        db.flush()
        branches = [m.Sucursal(nombre=name, empresa_id=empresas[company].id, tarifa_auto=1000, tarifa_moto=500,
                              tarifa_camioneta=1500, tiempo_cortesia_min=10, fraccion_minutos=15)
                    for name, company in [("Alpha Centro", 0), ("Alpha Norte", 0), ("Beta Centro", 1)]]
        db.add_all(branches)
        db.flush()
        towers = [m.Torre(numero=i + 1, capacidad=50, sucursal_id=b.id, porcentaje_descuento=0) for i, b in enumerate(branches)]
        db.add_all(towers)
        specs = [
            ("admin_a1", "ADMIN", 0, ""), ("admin_a2", "ADMIN", 1, ""), ("admin_b1", "ADMIN", 2, ""),
            ("op_a1", "OPERADOR", 0, "ingreso,salida,ver_ocupacion"),
            ("op_a2", "OPERADOR", 1, "ingreso,salida,ver_ocupacion"),
            ("op_b1", "OPERADOR", 2, "ingreso,salida,ver_ocupacion"),
            ("viewer", "OPERADOR", 0, "ver_ocupacion"),
            ("history", "OPERADOR", 0, "ver_historial"),
            ("finance", "OPERADOR", 0, "ver_stats"),
            ("entry", "OPERADOR", 0, "ingreso"),
            ("exit", "OPERADOR", 0, "salida"),
            ("unknown", "OPERADOR", 0, "all,SUPERADMIN,config_sucursal"),
            ("root", "SUPERADMIN", None, "all"),
        ]
        users = {}
        for name, role, branch, permissions in specs:
            user = m.Usuario(email=f"{name}@sf02a.example.com", rol=role, sucursal_id=branches[branch].id if branch is not None else None,
                             permisos=permissions, password_hash=demo_hash())
            db.add(user)
            users[name] = user
        db.flush()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        active, historic = [], []
        for i, tower in enumerate(towers):
            operator = users[["op_a1", "op_a2", "op_b1"][i]]
            for closed in (False, True):
                plate = f"FIX{i + 1}{'OLD' if closed else 'ACT'}"
                vehicle = m.Vehiculo(patente=plate, tipo="AUTO")
                db.add(vehicle)
                db.flush()
                stay = m.Estadia(vehiculo_id=vehicle.id, torre_id=tower.id, usuario_ingreso_id=operator.id,
                                sucursal_id=branches[i].id,
                                usuario_salida_id=operator.id if closed else None,
                                fecha_entrada=now - timedelta(hours=2), fecha_salida=now if closed else None,
                                fecha_entrada_utc=(now - timedelta(hours=2)).replace(tzinfo=timezone.utc),
                                fecha_salida_utc=now.replace(tzinfo=timezone.utc) if closed else None,
                                estado="FINALIZADO" if closed else "ACTIVO", monto=(i + 1) * 100 if closed else 0,
                                metodo_pago="EFECTIVO" if closed else None, tipo_vehiculo_registrado="AUTO")
                db.add(stay)
                (historic if closed else active).append(stay)
            db.add(m.CierreCaja(sucursal_id=branches[i].id, usuario_id=users[["admin_a1", "admin_a2", "admin_b1"][i]].id,
                               fecha_apertura=now - timedelta(hours=3),
                               fecha_apertura_utc=(now - timedelta(hours=3)).replace(tzinfo=timezone.utc),
                               origen_datos="UTC_POR_TURNO", estado="ABIERTA", monto_esperado=0))
        db.commit()
        return {
            "branches": [b.id for b in branches], "towers": [t.id for t in towers],
            "users": {name: user.id for name, user in users.items()},
            "active": [s.id for s in active], "historic": [s.id for s in historic],
        }


if __name__ == "__main__":
    result = reset_and_seed()
    print("Release: fixtures de regresión, 2 empresas, 3 sucursales y 13 usuarios ficticios preparados.")
    print("Cuenta de prueba: admin_a1@sf02a.example.com / sf02a-demo-only; operador: op_a1@sf02a.example.com")

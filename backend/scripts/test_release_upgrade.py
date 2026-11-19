"""Verificación reproducible de upgrade, sólo en bases NUEVAS release_upgrade_*.

No borra/reutiliza bases. No modifica release_disposable ni las demos anteriores.
Ejecutar desde /app en el contenedor release con RELEASE_ALLOW_RESET=1.
Las URLs con credenciales se derivan dentro del proceso y nunca se imprimen.
"""
import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

from app.core.config import settings
from scripts.access_test_data import require_disposable_database

OLD = "d24ac9f31e02"
NEW = "bc42ad61837e"
LEGACY_ENTRY = datetime(2026, 10, 1, 10, 11, 12)
LEGACY_EXIT = datetime(2026, 10, 1, 12, 13, 14)
CREATED = []


@contextmanager
def migration_target(url):
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = url.render_as_string(hide_password=False)
    try:
        yield
    finally:
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous


def migrate(url, revision):
    config_path = Path.cwd() / "alembic.ini"
    if not config_path.is_file():
        raise RuntimeError("Ejecutar desde el directorio backend (/app en Docker)")
    with migration_target(url):
        command.upgrade(Config(str(config_path)), revision)


def create_new_database(base_url, label):
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S") + "_" + uuid4().hex[:8]
    name = f"release_upgrade_{label}_{suffix}"
    if not name.startswith("release_upgrade_") or len(name) > 63:
        raise RuntimeError("Nombre de recurso descartable inválido")
    admin = create_engine(base_url.set(database="postgres"), isolation_level="AUTOCOMMIT", poolclass=NullPool)
    try:
        with admin.connect() as connection:
            if connection.execute(text("SELECT 1 FROM pg_database WHERE datname=:name"), {"name": name}).first():
                raise RuntimeError("La base ya existe; no se reutiliza ni elimina")
            quoted = connection.dialect.identifier_preparer.quote(name)
            connection.execute(text("CREATE DATABASE " + quoted))
        CREATED.append(name)
        print("CREADA " + name, flush=True)
    finally:
        admin.dispose()
    return base_url.set(database=name)


def seed_old_schema(engine):
    with engine.begin() as db:
        company = db.execute(text("INSERT INTO empresas(nombre,cuit) VALUES ('Upgrade sintético','UPGRADE-ONLY') RETURNING id")).scalar_one()
        branch = db.execute(text("""
            INSERT INTO sucursales(nombre,empresa_id,tarifa_auto,tarifa_moto,tarifa_camioneta,tiempo_cortesia_min,fraccion_minutos)
            VALUES ('Sector de prueba',:company,1000.125,500,1500,10,15) RETURNING id
        """), {"company": company}).scalar_one()
        towers = [db.execute(text("INSERT INTO torres(numero,capacidad,sucursal_id,porcentaje_descuento) VALUES (:number,20,:branch,0.15) RETURNING id"),
                             {"number": number, "branch": branch}).scalar_one() for number in (1, 2)]
        user = db.execute(text("""
            INSERT INTO usuarios(email,password_hash,rol,permisos,sucursal_id)
            VALUES ('upgrade@example.com','synthetic-no-login','OPERADOR','ingreso,salida',:branch) RETURNING id
        """), {"branch": branch}).scalar_one()
        vehicle = db.execute(text("INSERT INTO vehiculos(patente,tipo) VALUES ('UPG0001','AUTO') RETURNING id")).scalar_one()
        values = {"vehicle": vehicle, "tower": towers[0], "user": user, "entry": LEGACY_ENTRY, "exit": LEGACY_EXIT}
        active = db.execute(text("""
            INSERT INTO estadias(vehiculo_id,torre_id,usuario_ingreso_id,fecha_entrada,monto,estado,tipo_vehiculo_registrado)
            VALUES (:vehicle,:tower,:user,:entry,0,'ACTIVO','AUTO') RETURNING id
        """), values).scalar_one()
        historic = db.execute(text("""
            INSERT INTO estadias(vehiculo_id,torre_id,usuario_ingreso_id,usuario_salida_id,fecha_entrada,fecha_salida,monto,estado,metodo_pago,tipo_vehiculo_registrado)
            VALUES (:vehicle,:tower,:user,:user,:entry,:exit,12.345,'FINALIZADO','EFECTIVO','AUTO') RETURNING id
        """), values).scalar_one()
        closed = db.execute(text("""
            INSERT INTO cierres_caja(sucursal_id,usuario_id,fecha_apertura,fecha_cierre,monto_esperado,monto_real,diferencia,estado,notas)
            VALUES (:branch,:user,:entry,:exit,12.345,12.34,-0.005,'CERRADA','Nota heredada controlada') RETURNING id
        """), {**values, "branch": branch}).scalar_one()
        opened = db.execute(text("""
            INSERT INTO cierres_caja(sucursal_id,usuario_id,fecha_apertura,monto_esperado,diferencia,estado)
            VALUES (:branch,:user,:entry,0,0,'ABIERTA') RETURNING id
        """), {**values, "branch": branch}).scalar_one()
    return {"branch": branch, "towers": towers, "user": user, "vehicle": vehicle,
            "active": active, "historic": historic, "closed": closed, "opened": opened}


def assert_old_schema(engine):
    inspector = inspect(engine)
    assert "activo" not in {column["name"] for column in inspector.get_columns("usuarios")}
    assert "sucursal_id" not in {column["name"] for column in inspector.get_columns("estadias")}
    assert "cotizaciones" not in inspector.get_table_names()
    assert "operaciones_idempotentes" not in inspector.get_table_names()
    with engine.connect() as db:
        assert db.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == OLD


def verify_valid_upgrade(url):
    migrate(url, OLD)
    engine = create_engine(url, poolclass=NullPool)
    try:
        ids = seed_old_schema(engine)
        migrate(url, NEW)
        with engine.connect() as db:
            assert db.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == NEW
            assert db.execute(text("SELECT activo FROM usuarios WHERE id=:id"), {"id": ids["user"]}).scalar_one() is True
            stay = db.execute(text("SELECT * FROM estadias WHERE id=:id"), {"id": ids["active"]}).mappings().one()
            assert stay["sucursal_id"] == ids["branch"]
            assert stay["fecha_entrada"] == LEGACY_ENTRY and stay["fecha_entrada_utc"] is None
            assert stay["reglas_ingreso"] is None and stay["caja_id"] is None and stay["caja_ingreso_id"] is None
            history = db.execute(text("SELECT * FROM estadias WHERE id=:id"), {"id": ids["historic"]}).mappings().one()
            assert history["fecha_salida"] == LEGACY_EXIT and history["fecha_salida_utc"] is None
            assert history["monto"] == Decimal("12.35")
            box = db.execute(text("SELECT * FROM cierres_caja WHERE id=:id"), {"id": ids["closed"]}).mappings().one()
            assert box["origen_datos"] == "HEREDADO_SIN_VINCULO"
            assert box["recaudacion_total"] is None and box["totales_por_medio"] is None
            assert box["fecha_apertura_utc"] is None and box["fecha_cierre_utc"] is None
            assert box["notas"] == "Nota heredada controlada"
            assert box["monto_esperado"] == Decimal("12.35") and box["diferencia"] == Decimal("-0.01")
            branch = db.execute(text("SELECT tarifa_auto, direccion, telefono FROM sucursales WHERE id=:id"),
                                {"id": ids["branch"]}).mappings().one()
            assert branch["tarifa_auto"] == Decimal("1000.13")
            assert branch["direccion"] is None and branch["telefono"] is None
        inspector = inspect(engine)
        money_column = next(column for column in inspector.get_columns("estadias") if column["name"] == "monto")
        assert money_column["type"].precision == 14 and money_column["type"].scale == 2
        assert {index["name"] for index in inspector.get_indexes("estadias")} >= {"uq_estadia_activa_sucursal_vehiculo"}
        assert {index["name"] for index in inspector.get_indexes("cierres_caja")} >= {"uq_caja_abierta_sucursal"}
        print("APROBADO upgrade representativo: dinero Numeric, identidad/sucursal, timestamps y datos heredados conservados", flush=True)
    finally:
        engine.dispose()


def expect_refusal(url, engine, marker, label):
    try:
        migrate(url, NEW)
    except RuntimeError as exc:
        assert marker in str(exc), "El rechazo no coincide con el conflicto controlado"
    else:
        raise AssertionError("El upgrade aceptó datos ambiguos o no finitos")
    assert_old_schema(engine)
    print("APROBADO rechazo atómico: " + label, flush=True)


def verify_invalid_upgrade(url):
    migrate(url, OLD)
    engine = create_engine(url, poolclass=NullPool)
    try:
        ids = seed_old_schema(engine)
        with engine.begin() as db:
            duplicate_box = db.execute(text("""
                INSERT INTO cierres_caja(sucursal_id,usuario_id,fecha_apertura,monto_esperado,diferencia,estado)
                SELECT sucursal_id,usuario_id,fecha_apertura,0,0,'ABIERTA' FROM cierres_caja WHERE id=:id RETURNING id
            """), {"id": ids["opened"]}).scalar_one()
            duplicate_stay = db.execute(text("""
                INSERT INTO estadias(vehiculo_id,torre_id,usuario_ingreso_id,fecha_entrada,monto,estado,tipo_vehiculo_registrado)
                VALUES (:vehicle,:tower,:user,:entry,0,'ACTIVO','AUTO') RETURNING id
            """), {"vehicle": ids["vehicle"], "tower": ids["towers"][1], "user": ids["user"], "entry": LEGACY_ENTRY}).scalar_one()
            db.execute(text("UPDATE estadias SET monto='NaN'::double precision WHERE id=:id"), {"id": ids["historic"]})
        expect_refusal(url, engine, "varios turnos abiertos", "turnos abiertos duplicados")
        with engine.begin() as db:
            db.execute(text("DELETE FROM cierres_caja WHERE id=:id"), {"id": duplicate_box})
        expect_refusal(url, engine, "varias estadías activas", "patente activa duplicada en sectores de una sucursal")
        with engine.begin() as db:
            db.execute(text("DELETE FROM estadias WHERE id=:id"), {"id": duplicate_stay})
        expect_refusal(url, engine, "Importes heredados inválidos en estadias.monto", "importe NaN")
    finally:
        engine.dispose()


def main():
    require_disposable_database()
    base = make_url(settings.DATABASE_URL)
    valid = create_new_database(base, "valid")
    invalid = create_new_database(base, "invalid")
    verify_valid_upgrade(valid)
    verify_invalid_upgrade(invalid)
    print(json.dumps({"estado": "APROBADO", "bases_creadas_conservadas": CREATED,
                      "base_demo_no_modificada": "release_disposable"}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"estado": "FALLIDO", "error_tipo": type(exc).__name__, "bases_creadas_conservadas": CREATED}), flush=True)
        raise SystemExit(1) from None

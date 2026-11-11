"""Dinero exacto, turnos concretos, cotización e idempotencia persistida.

Revision ID: e31b19ac0284
Revises: d24ac9f31e02
"""
from alembic import op
import sqlalchemy as sa

revision = "e31b19ac0284"
down_revision = "d24ac9f31e02"
branch_labels = None
depends_on = None


def _refuse_ambiguous_legacy_data(bind):
    checks = [
        ("SELECT 1 FROM cierres_caja WHERE estado='ABIERTA' GROUP BY sucursal_id HAVING count(*)>1 LIMIT 1",
         "Hay varios turnos abiertos por sucursal; conciliar los datos antes de migrar."),
        ("SELECT 1 FROM estadias e LEFT JOIN torres t ON t.id=e.torre_id WHERE t.sucursal_id IS NULL LIMIT 1",
         "Hay estadías sin sucursal derivable de su sector; revisar sin inventar datos."),
        ("SELECT 1 FROM estadias e JOIN torres t ON t.id=e.torre_id WHERE e.estado='ACTIVO' GROUP BY t.sucursal_id,e.vehiculo_id HAVING count(*)>1 LIMIT 1",
         "Hay patentes con varias estadías activas en una sucursal; conciliar antes de migrar."),
    ]
    for sql, message in checks:
        if bind.execute(sa.text(sql)).first():
            raise RuntimeError(message)
    for table, column, negative_allowed in [
        ("sucursales", "tarifa_auto", False), ("sucursales", "tarifa_moto", False),
        ("sucursales", "tarifa_camioneta", False), ("estadias", "monto", False),
        ("cierres_caja", "monto_esperado", False), ("cierres_caja", "monto_real", False),
        ("cierres_caja", "diferencia", True),
    ]:
        sql = f"SELECT 1 FROM {table} WHERE {column}::text IN ('NaN','Infinity','-Infinity') OR abs({column}) >= 1000000000000"
        if not negative_allowed:
            sql += f" OR {column}<0"
        if bind.execute(sa.text(sql + " LIMIT 1")).first():
            raise RuntimeError(f"Importes heredados inválidos en {table}.{column}; no se corrigieron automáticamente.")
    if bind.execute(sa.text("SELECT 1 FROM torres WHERE porcentaje_descuento::text IN ('NaN','Infinity','-Infinity') OR porcentaje_descuento<0 OR porcentaje_descuento>1 LIMIT 1")).first():
        raise RuntimeError("Descuentos heredados fuera de rango; revisar antes de migrar.")


def upgrade():
    bind = op.get_bind()
    _refuse_ambiguous_legacy_data(bind)
    op.add_column("usuarios", sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()))
    for table, columns in {
        "sucursales": ["tarifa_auto", "tarifa_moto", "tarifa_camioneta"],
        "estadias": ["monto"], "cierres_caja": ["monto_esperado", "monto_real", "diferencia"],
    }.items():
        for column in columns:
            op.alter_column(table, column, type_=sa.Numeric(14, 2),
                            postgresql_using=f"round({column}::numeric, 2)")
    op.alter_column("torres", "porcentaje_descuento", type_=sa.Numeric(7, 6),
                    postgresql_using="porcentaje_descuento::numeric")
    op.add_column("estadias", sa.Column("sucursal_id", sa.Integer(), nullable=True))
    op.execute("UPDATE estadias e SET sucursal_id=t.sucursal_id FROM torres t WHERE t.id=e.torre_id")
    op.alter_column("estadias", "sucursal_id", nullable=False)
    op.create_foreign_key("fk_estadia_sucursal", "estadias", "sucursales", ["sucursal_id"], ["id"])
    for column in ["caja_ingreso_id", "caja_id"]:
        op.add_column("estadias", sa.Column(column, sa.Integer(), nullable=True))
        op.create_foreign_key(f"fk_estadia_{column}", "estadias", "cierres_caja", [column], ["id"])
    for table, names in {
        "estadias": ["fecha_entrada_utc", "fecha_salida_utc"],
        "cierres_caja": ["fecha_apertura_utc", "fecha_cierre_utc"],
    }.items():
        for name in names:
            # No backfill: los timestamps sin zona anteriores no prueban UTC.
            op.add_column(table, sa.Column(name, sa.DateTime(timezone=True), nullable=True))
    op.add_column("estadias", sa.Column("reglas_ingreso", sa.JSON(), nullable=True))
    op.add_column("estadias", sa.Column("cotizacion_id", sa.String(36), nullable=True))
    op.add_column("cierres_caja", sa.Column("fondo_inicial", sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("cierres_caja", sa.Column("recaudacion_total", sa.Numeric(14, 2), nullable=True))
    op.add_column("cierres_caja", sa.Column("totales_por_medio", sa.JSON(), nullable=True))
    op.add_column("cierres_caja", sa.Column("origen_datos", sa.String(24), nullable=False, server_default="HEREDADO_SIN_VINCULO"))
    op.create_index("uq_caja_abierta_sucursal", "cierres_caja", ["sucursal_id"], unique=True,
                    postgresql_where=sa.text("estado='ABIERTA'"))
    op.create_index("uq_estadia_activa_sucursal_vehiculo", "estadias", ["sucursal_id", "vehiculo_id"], unique=True,
                    postgresql_where=sa.text("estado='ACTIVO'"))
    op.create_check_constraint("ck_estadia_monto_no_negativo", "estadias", "monto>=0 AND monto::text NOT IN ('NaN','Infinity','-Infinity')")
    op.create_check_constraint("ck_caja_importes_no_negativos", "cierres_caja", "monto_esperado>=0 AND (monto_real IS NULL OR monto_real>=0) AND monto_esperado::text NOT IN ('NaN','Infinity','-Infinity') AND (monto_real IS NULL OR monto_real::text NOT IN ('NaN','Infinity','-Infinity'))")
    op.create_table("cotizaciones",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("estadia_id", sa.Integer(), sa.ForeignKey("estadias.id"), nullable=False),
        sa.Column("sucursal_id", sa.Integer(), sa.ForeignKey("sucursales.id"), nullable=False),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("calculada_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("vence_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("monto", sa.Numeric(14, 2), nullable=False),
        sa.Column("origen_reglas", sa.String(32), nullable=False),
        sa.Column("explicacion", sa.JSON(), nullable=False),
        sa.Column("reglas", sa.JSON(), nullable=False),
    )
    op.create_table("operaciones_idempotentes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sucursal_id", sa.Integer(), sa.ForeignKey("sucursales.id"), nullable=False),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("tipo", sa.String(24), nullable=False), sa.Column("clave", sa.String(128), nullable=False),
        sa.Column("huella", sa.String(64), nullable=False), sa.Column("respuesta", sa.JSON(), nullable=False),
        sa.Column("creada_en", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("sucursal_id", "tipo", "clave", name="uq_operacion_idempotente"),
    )


def downgrade():
    # El downgrade restaura esquema, no reconstruye la precisión float ni las garantías nuevas.
    op.drop_table("operaciones_idempotentes")
    op.drop_table("cotizaciones")
    op.drop_constraint("ck_caja_importes_no_negativos", "cierres_caja")
    op.drop_constraint("ck_estadia_monto_no_negativo", "estadias")
    op.drop_index("uq_estadia_activa_sucursal_vehiculo", table_name="estadias")
    op.drop_index("uq_caja_abierta_sucursal", table_name="cierres_caja")
    for column in ["origen_datos", "totales_por_medio", "recaudacion_total", "fondo_inicial", "fecha_apertura_utc", "fecha_cierre_utc"]:
        op.drop_column("cierres_caja", column)
    for column in ["cotizacion_id", "reglas_ingreso", "fecha_salida_utc", "fecha_entrada_utc", "caja_id", "caja_ingreso_id", "sucursal_id"]:
        op.drop_column("estadias", column)
    for table, columns in {
        "sucursales": ["tarifa_auto", "tarifa_moto", "tarifa_camioneta"],
        "estadias": ["monto"], "cierres_caja": ["monto_esperado", "monto_real", "diferencia"],
        "torres": ["porcentaje_descuento"],
    }.items():
        for column in columns:
            op.alter_column(table, column, type_=sa.Float(), postgresql_using=f"{column}::double precision")
    op.drop_column("usuarios", "activo")

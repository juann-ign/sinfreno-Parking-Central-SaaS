"""Snapshot de categoría por estadía para aislar sucursales.

Revision ID: d24ac9f31e02
Revises: ab35d88bd0a4
"""
from alembic import op
import sqlalchemy as sa

revision = "d24ac9f31e02"
down_revision = "ab35d88bd0a4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("estadias", sa.Column("tipo_vehiculo_registrado", sa.String(), nullable=True))
    op.execute(sa.text("""
        UPDATE estadias AS e SET tipo_vehiculo_registrado = COALESCE(v.tipo, 'AUTO')
        FROM vehiculos AS v WHERE v.id = e.vehiculo_id
    """))


def downgrade():
    op.drop_column("estadias", "tipo_vehiculo_registrado")

"""Contacto opcional de la cochera para los tickets.

Revision ID: bc42ad61837e
Revises: e31b19ac0284
"""
from alembic import op
import sqlalchemy as sa

revision = "bc42ad61837e"
down_revision = "e31b19ac0284"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("sucursales", sa.Column("direccion", sa.String(200), nullable=True))
    op.add_column("sucursales", sa.Column("telefono", sa.String(40), nullable=True))


def downgrade():
    op.drop_column("sucursales", "telefono")
    op.drop_column("sucursales", "direccion")

"""Bandeja de WhatsApp: id del proveedor y momentos de envío, entrega y lectura.

`id_externo` es el id que da Meta al mensaje; el webhook de estados lo usa para encontrar la fila.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notificaciones", sa.Column("id_externo", sa.String(120)))
    for columna in ("enviada_en", "entregada_en", "leida_en"):
        op.add_column("notificaciones", sa.Column(columna, sa.DateTime(timezone=True)))
    op.create_index("ix_notificaciones_id_externo", "notificaciones", ["id_externo"])
    op.create_index(
        "ix_notificaciones_fallidas",
        "notificaciones",
        ["creado_en"],
        postgresql_where=sa.text("estado = 'fallida'"),
    )


def downgrade() -> None:
    op.drop_index("ix_notificaciones_fallidas", table_name="notificaciones")
    op.drop_index("ix_notificaciones_id_externo", table_name="notificaciones")
    for columna in ("leida_en", "entregada_en", "enviada_en", "id_externo"):
        op.drop_column("notificaciones", columna)

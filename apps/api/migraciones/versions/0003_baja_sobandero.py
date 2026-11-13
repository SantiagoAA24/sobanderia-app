"""Columna `baja_en` en sobanderos: la baja con las citas próximas «dejadas como están».

Mientras tenga citas agendadas la cuenta sigue activa pero ya no recibe citas nuevas; al cerrar la
última, la cuenta se desactiva sola.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sobanderos", sa.Column("baja_en", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("sobanderos", "baja_en")

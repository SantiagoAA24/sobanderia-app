"""Tabla intentos_ingreso para limitar intentos fallidos de ingreso y recuperación.

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "intentos_ingreso",
        sa.Column("id", sa.BigInteger, sa.Identity(), primary_key=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("correo", sa.String(254), nullable=False),
        sa.Column("ip", sa.String(45), nullable=False),
        sa.Column(
            "momento", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_intentos_ingreso_correo", "intentos_ingreso", ["tipo", "correo", "momento"])
    op.create_index("ix_intentos_ingreso_ip", "intentos_ingreso", ["tipo", "ip", "momento"])


def downgrade() -> None:
    op.drop_table("intentos_ingreso")

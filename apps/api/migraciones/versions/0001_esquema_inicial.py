"""Esquema inicial: doce tablas, enums, citext, btree_gist y citas_sin_cruce.

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

from app.modelos.tipos import (
    ENUMS,
    estado_cita,
    estado_notificacion,
    origen_cita,
    quien_cancela,
    rol_usuario,
    tipo_notificacion,
)

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _id() -> sa.Column[int]:
    return sa.Column("id", sa.BigInteger, sa.Identity(), primary_key=True)


def _creado_en() -> sa.Column[object]:
    return sa.Column(
        "creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")
    for enum in ENUMS:
        enum.create(op.get_bind(), checkfirst=False)

    op.create_table(
        "negocio",
        sa.Column("id", sa.SmallInteger, primary_key=True, server_default="1"),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("direccion", sa.String(200), nullable=False),
        sa.Column("telefono", sa.String(30), nullable=False),
        sa.Column("mensaje_bienvenida", sa.String(500), nullable=False),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("id = 1", name="ck_negocio_una_sola_fila"),
    )

    op.create_table(
        "usuarios",
        _id(),
        sa.Column("correo", pg.CITEXT, nullable=False, unique=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("clave_hash", sa.String(255), nullable=False),
        sa.Column("rol", rol_usuario, nullable=False),
        sa.Column("activo", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("debe_cambiar_clave", sa.Boolean, server_default=sa.true(), nullable=False),
        _creado_en(),
    )

    op.create_table(
        "sesiones",
        _id(),
        sa.Column(
            "usuario_id",
            sa.BigInteger,
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("vence_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "ultimo_uso", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        _creado_en(),
    )
    op.create_index("ix_sesiones_usuario_id", "sesiones", ["usuario_id"])

    op.create_table(
        "recuperaciones_clave",
        _id(),
        sa.Column(
            "usuario_id",
            sa.BigInteger,
            sa.ForeignKey("usuarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("vence_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usado", sa.Boolean, server_default=sa.false(), nullable=False),
        _creado_en(),
    )

    op.create_table(
        "sobanderos",
        _id(),
        sa.Column(
            "usuario_id", sa.BigInteger, sa.ForeignKey("usuarios.id"), nullable=False, unique=True
        ),
        sa.Column("recibe_citas", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("duracion_min", sa.SmallInteger, server_default="30", nullable=False),
        sa.CheckConstraint(
            "duracion_min IN (20, 30, 45, 60)", name="ck_sobanderos_duracion_valida"
        ),
    )

    op.create_table(
        "horarios",
        _id(),
        sa.Column(
            "sobandero_id",
            sa.BigInteger,
            sa.ForeignKey("sobanderos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dia_semana", sa.SmallInteger, nullable=False),
        sa.Column("desde", sa.Time, nullable=False),
        sa.Column("hasta", sa.Time, nullable=False),
        sa.CheckConstraint("dia_semana BETWEEN 0 AND 6", name="ck_horarios_dia_valido"),
        sa.CheckConstraint("desde < hasta", name="ck_horarios_franja_valida"),
        sa.UniqueConstraint(
            "sobandero_id", "dia_semana", "desde", name="uq_horarios_sobandero_id_dia_semana_desde"
        ),
    )

    op.create_table(
        "bloqueos",
        _id(),
        sa.Column(
            "sobandero_id",
            sa.BigInteger,
            sa.ForeignKey("sobanderos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rango", pg.TSTZRANGE, nullable=False),
        sa.Column("motivo", sa.String(200)),
        _creado_en(),
        sa.CheckConstraint("NOT isempty(rango)", name="ck_bloqueos_rango_valido"),
    )
    op.create_index(
        "ix_bloqueos_sobandero_id_rango",
        "bloqueos",
        ["sobandero_id", "rango"],
        postgresql_using="gist",
    )

    op.create_table(
        "clientes",
        _id(),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("celular", sa.String(16), nullable=False, unique=True),
        sa.Column("politica_aceptada_en", sa.DateTime(timezone=True)),
        sa.Column("politica_version", sa.String(20)),
        _creado_en(),
        sa.CheckConstraint(r"celular ~ '^\+[1-9][0-9]{7,14}$'", name="ck_clientes_celular_e164"),
    )

    op.create_table(
        "citas",
        _id(),
        sa.Column("sobandero_id", sa.BigInteger, sa.ForeignKey("sobanderos.id"), nullable=False),
        sa.Column("cliente_id", sa.BigInteger, sa.ForeignKey("clientes.id"), nullable=False),
        sa.Column("rango", pg.TSTZRANGE, nullable=False),
        sa.Column("estado", estado_cita, server_default="agendada", nullable=False),
        sa.Column("origen", origen_cita, nullable=False),
        sa.Column("cancelada_por", quien_cancela),
        _creado_en(),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("NOT isempty(rango)", name="ck_citas_rango_valido"),
    )
    op.create_index("ix_citas_cliente_id", "citas", ["cliente_id"])
    # La única garantía contra el doble agendamiento. El código solo traduce su error.
    op.execute(
        """
        ALTER TABLE citas ADD CONSTRAINT citas_sin_cruce
          EXCLUDE USING gist (sobandero_id WITH =, rango WITH &&)
          WHERE (estado <> 'cancelada')
        """
    )

    op.create_table(
        "enlaces_cita",
        _id(),
        sa.Column(
            "cita_id",
            sa.BigInteger,
            sa.ForeignKey("citas.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("vence_en", sa.DateTime(timezone=True), nullable=False),
        _creado_en(),
    )

    op.create_table(
        "notificaciones",
        _id(),
        sa.Column(
            "cita_id",
            sa.BigInteger,
            sa.ForeignKey("citas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tipo", tipo_notificacion, nullable=False),
        sa.Column("plantilla", sa.String(80), nullable=False),
        sa.Column("variables", pg.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("enviar_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("estado", estado_notificacion, server_default="pendiente", nullable=False),
        sa.Column("intentos", sa.SmallInteger, server_default="0", nullable=False),
        sa.Column("ultimo_error", sa.String(500)),
        _creado_en(),
    )
    op.create_index("ix_notificaciones_cita_id", "notificaciones", ["cita_id"])
    op.create_index(
        "ix_notificaciones_pendientes",
        "notificaciones",
        ["enviar_en"],
        postgresql_where=sa.text("estado = 'pendiente'"),
    )

    op.create_table(
        "auditoria",
        _id(),
        sa.Column("usuario_id", sa.BigInteger, sa.ForeignKey("usuarios.id", ondelete="SET NULL")),
        sa.Column("accion", sa.String(80), nullable=False),
        sa.Column("entidad", sa.String(60), nullable=False),
        sa.Column("entidad_id", sa.BigInteger),
        sa.Column("detalle", pg.JSONB),
        _creado_en(),
    )
    op.create_index("ix_auditoria_entidad", "auditoria", ["entidad", "entidad_id"])


def downgrade() -> None:
    for tabla in (
        "auditoria",
        "notificaciones",
        "enlaces_cita",
        "citas",
        "clientes",
        "bloqueos",
        "horarios",
        "sobanderos",
        "recuperaciones_clave",
        "sesiones",
        "usuarios",
        "negocio",
    ):
        op.drop_table(tabla)
    for enum in reversed(ENUMS):
        enum.drop(op.get_bind(), checkfirst=False)
    op.execute("DROP EXTENSION IF EXISTS citext")
    op.execute("DROP EXTENSION IF EXISTS btree_gist")

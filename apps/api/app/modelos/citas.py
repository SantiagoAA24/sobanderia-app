from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSTZRANGE, Range
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.modelos.tipos import (
    CreadoEn,
    Momento,
    estado_cita,
    estado_notificacion,
    origen_cita,
    quien_cancela,
    tipo_notificacion,
)


class Cliente(Base):
    """Quien agenda, sin cuenta. El celular va en formato E.164 y nunca se registra completo."""

    __tablename__ = "clientes"
    __table_args__ = (CheckConstraint(r"celular ~ '^\+[1-9][0-9]{7,14}$'", name="celular_e164"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    celular: Mapped[str] = mapped_column(String(16), unique=True)
    politica_aceptada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    politica_version: Mapped[str | None] = mapped_column(String(20))
    creado_en: Mapped[CreadoEn]


class Cita(Base):
    """La restricción `citas_sin_cruce` se crea en la migración 0001 (EXCLUDE USING gist)."""

    __tablename__ = "citas"
    __table_args__ = (
        CheckConstraint("NOT isempty(rango)", name="rango_valido"),
        Index("ix_citas_sobandero_id_rango", "sobandero_id", "rango", postgresql_using="gist"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sobandero_id: Mapped[int] = mapped_column(ForeignKey("sobanderos.id"))
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"))
    rango: Mapped[Range[datetime]] = mapped_column(TSTZRANGE)
    estado: Mapped[str] = mapped_column(estado_cita, server_default="agendada")
    origen: Mapped[str] = mapped_column(origen_cita)
    cancelada_por: Mapped[str | None] = mapped_column(quien_cancela)
    creado_en: Mapped[CreadoEn]
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def inicio(self) -> datetime:
        assert self.rango.lower is not None
        return self.rango.lower

    @property
    def fin(self) -> datetime:
        assert self.rango.upper is not None
        return self.rango.upper


class EnlaceCita(Base):
    __tablename__ = "enlaces_cita"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    cita_id: Mapped[int] = mapped_column(ForeignKey("citas.id", ondelete="CASCADE"), unique=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    vence_en: Mapped[Momento]
    creado_en: Mapped[CreadoEn]


class Notificacion(Base):
    """Bandeja de salida de WhatsApp; el worker la revisa."""

    __tablename__ = "notificaciones"
    __table_args__ = (
        Index(
            "ix_notificaciones_pendientes",
            "enviar_en",
            postgresql_where=text("estado = 'pendiente'"),
        ),
        Index("ix_notificaciones_id_externo", "id_externo"),
        Index(
            "ix_notificaciones_fallidas",
            "creado_en",
            postgresql_where=text("estado = 'fallida'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    cita_id: Mapped[int] = mapped_column(ForeignKey("citas.id", ondelete="CASCADE"))
    tipo: Mapped[str] = mapped_column(tipo_notificacion)
    plantilla: Mapped[str] = mapped_column(String(80))
    variables: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    enviar_en: Mapped[Momento]
    estado: Mapped[str] = mapped_column(estado_notificacion, server_default="pendiente")
    intentos: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    ultimo_error: Mapped[str | None] = mapped_column(String(500))
    id_externo: Mapped[str | None] = mapped_column(String(120))  # id del mensaje en Meta
    enviada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    entregada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    leida_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[CreadoEn]

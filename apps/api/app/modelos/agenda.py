from datetime import datetime, time

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    Time,
    UniqueConstraint,
    true,
)
from sqlalchemy.dialects.postgresql import TSTZRANGE, Range
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.modelos.tipos import CreadoEn
from app.modelos.usuarios import Usuario


class Sobandero(Base):
    __tablename__ = "sobanderos"
    __table_args__ = (CheckConstraint("duracion_min IN (20, 30, 45, 60)", name="duracion_valida"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), unique=True)
    recibe_citas: Mapped[bool] = mapped_column(Boolean, server_default=true())
    duracion_min: Mapped[int] = mapped_column(SmallInteger, server_default="30")
    # Cuándo se le dio de baja; con citas «dejadas» la cuenta sigue activa hasta cerrarlas.
    baja_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    usuario: Mapped[Usuario] = relationship()


class Horario(Base):
    """Franja de atención semanal. `dia_semana`: 0 = lunes ... 6 = domingo. Horas de Bogotá."""

    __tablename__ = "horarios"
    __table_args__ = (
        CheckConstraint("dia_semana BETWEEN 0 AND 6", name="dia_valido"),
        CheckConstraint("desde < hasta", name="franja_valida"),
        UniqueConstraint("sobandero_id", "dia_semana", "desde"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sobandero_id: Mapped[int] = mapped_column(ForeignKey("sobanderos.id", ondelete="CASCADE"))
    dia_semana: Mapped[int] = mapped_column(SmallInteger)
    desde: Mapped[time] = mapped_column(Time)
    hasta: Mapped[time] = mapped_column(Time)


class Bloqueo(Base):
    __tablename__ = "bloqueos"
    __table_args__ = (CheckConstraint("NOT isempty(rango)", name="rango_valido"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sobandero_id: Mapped[int] = mapped_column(ForeignKey("sobanderos.id", ondelete="CASCADE"))
    rango: Mapped[Range[datetime]] = mapped_column(TSTZRANGE)
    motivo: Mapped[str | None] = mapped_column(String(200))
    creado_en: Mapped[CreadoEn]

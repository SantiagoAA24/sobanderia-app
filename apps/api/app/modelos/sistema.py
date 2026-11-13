from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.modelos.tipos import CreadoEn


class Negocio(Base):
    """Una sola fila (id = 1) con lo que muestra la pantalla de inicio."""

    __tablename__ = "negocio"
    __table_args__ = (CheckConstraint("id = 1", name="una_sola_fila"),)

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, server_default="1")
    nombre: Mapped[str] = mapped_column(String(120))
    direccion: Mapped[str] = mapped_column(String(200))
    telefono: Mapped[str] = mapped_column(String(30))
    mensaje_bienvenida: Mapped[str] = mapped_column(String(500))
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Auditoria(Base):
    """Quién hizo qué. En `detalle` nunca van celulares completos ni claves."""

    __tablename__ = "auditoria"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))
    accion: Mapped[str] = mapped_column(String(80))
    entidad: Mapped[str] = mapped_column(String(60))
    entidad_id: Mapped[int | None] = mapped_column(BigInteger)
    detalle: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    creado_en: Mapped[CreadoEn]

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, false, func, true
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.modelos.tipos import CreadoEn, Momento, rol_usuario


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    correo: Mapped[str] = mapped_column(CITEXT, unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    clave_hash: Mapped[str] = mapped_column(String(255))  # argon2id
    rol: Mapped[str] = mapped_column(rol_usuario)
    activo: Mapped[bool] = mapped_column(Boolean, server_default=true())
    debe_cambiar_clave: Mapped[bool] = mapped_column(Boolean, server_default=true())
    creado_en: Mapped[CreadoEn]


class Sesion(Base):
    """Sesión de un usuario; el token solo se guarda como hash."""

    __tablename__ = "sesiones"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    vence_en: Mapped[Momento]
    ultimo_uso: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    creado_en: Mapped[CreadoEn]

    usuario: Mapped[Usuario] = relationship()


class RecuperacionClave(Base):
    __tablename__ = "recuperaciones_clave"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    vence_en: Mapped[Momento]
    usado: Mapped[bool] = mapped_column(Boolean, server_default=false())
    creado_en: Mapped[CreadoEn]


class IntentoIngreso(Base):
    """Intento fallido de ingreso o solicitud de recuperación; sirve para limitar la frecuencia."""

    __tablename__ = "intentos_ingreso"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    tipo: Mapped[str] = mapped_column(String(20))  # "ingreso" o "recuperar"
    correo: Mapped[str] = mapped_column(String(254))  # normalizado en minúsculas
    ip: Mapped[str] = mapped_column(String(45))
    momento: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

"""Enums de PostgreSQL y alias de columnas compartidos por los modelos."""

from datetime import datetime
from typing import Annotated

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import mapped_column

ROLES = ("admin", "sobandero")
ESTADOS_CITA = ("agendada", "atendida", "no_asistio", "cancelada")
ORIGENES_CITA = ("cliente", "sobandero")
QUIEN_CANCELA = ("cliente", "sobandero", "admin")
TIPOS_NOTIFICACION = ("confirmacion", "recordatorio", "reprogramacion", "cancelacion")
ESTADOS_NOTIFICACION = ("pendiente", "enviada", "fallida", "cancelada")

rol_usuario = ENUM(*ROLES, name="rol_usuario", create_type=False)
estado_cita = ENUM(*ESTADOS_CITA, name="estado_cita", create_type=False)
origen_cita = ENUM(*ORIGENES_CITA, name="origen_cita", create_type=False)
quien_cancela = ENUM(*QUIEN_CANCELA, name="quien_cancela", create_type=False)
tipo_notificacion = ENUM(*TIPOS_NOTIFICACION, name="tipo_notificacion", create_type=False)
estado_notificacion = ENUM(*ESTADOS_NOTIFICACION, name="estado_notificacion", create_type=False)

ENUMS = (
    rol_usuario,
    estado_cita,
    origen_cita,
    quien_cancela,
    tipo_notificacion,
    estado_notificacion,
)

# Marca de tiempo con zona; siempre UTC.
Momento = Annotated[datetime, mapped_column(DateTime(timezone=True))]
CreadoEn = Annotated[
    datetime, mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
]

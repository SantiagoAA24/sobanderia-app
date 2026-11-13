"""Textos de fecha y hora para los mensajes, en español y en hora de Bogotá."""

from datetime import datetime

from app.servicios.horas import ZONA

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]  # fmt: skip


def dia_largo(momento: datetime) -> str:
    """«viernes 13 de noviembre»"""
    local = momento.astimezone(ZONA)
    return f"{DIAS[local.weekday()]} {local.day} de {MESES[local.month - 1]}"


def hora_12(momento: datetime) -> str:
    """«10:30 a. m.»"""
    local = momento.astimezone(ZONA)
    sufijo = "a. m." if local.hour < 12 else "p. m."
    return f"{local.hour % 12 or 12}:{local.minute:02d} {sufijo}"

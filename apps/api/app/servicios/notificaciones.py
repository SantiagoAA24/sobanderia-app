"""Bandeja de salida de WhatsApp. Se escribe en la misma transacción que el cambio de la cita."""

from datetime import datetime, time, timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.modelos import Cita, Cliente, Notificacion, Sobandero
from app.servicios.formato import dia_largo, hora_12
from app.servicios.horas import a_utc, dia_local

HORA_RECORDATORIO = time(18, 0)  # el día anterior, hora de Bogotá


def _variables(cita: Cita, cliente: Cliente, sobandero: Sobandero) -> dict[str, object]:
    inicio = cita.inicio
    return {
        "nombre": cliente.nombre,
        "sobandero": sobandero.usuario.nombre,
        "dia": dia_largo(inicio),
        "hora": hora_12(inicio),
        "duracion_min": sobandero.duracion_min,
    }


def encolar(
    db: Session,
    cita: Cita,
    cliente: Cliente,
    sobandero: Sobandero,
    tipo: str,
    plantilla: str,
    ahora: datetime,
    token: str | None = None,
) -> Notificacion:
    """`token` solo va en los mensajes con enlace de gestión; el worker lo borra al enviar."""
    variables = _variables(cita, cliente, sobandero)
    if token is not None:
        variables["token"] = token
    fila = Notificacion(
        cita_id=cita.id, tipo=tipo, plantilla=plantilla, variables=variables, enviar_en=ahora
    )
    db.add(fila)
    return fila


def encolar_recordatorio(
    db: Session, cita: Cita, cliente: Cliente, sobandero: Sobandero, ahora: datetime
) -> Notificacion | None:
    """Día anterior a las 6:00 p. m. Si ese momento ya pasó, no hay recordatorio."""
    enviar_en = a_utc(dia_local(cita.inicio) - timedelta(days=1), HORA_RECORDATORIO)
    if enviar_en <= ahora:
        return None
    fila = Notificacion(
        cita_id=cita.id,
        tipo="recordatorio",
        plantilla="recordatorio_cita",
        variables=_variables(cita, cliente, sobandero),
        enviar_en=enviar_en,
    )
    db.add(fila)
    return fila


def cancelar_pendientes(db: Session, cita_id: int) -> None:
    """Lo que no salió todavía deja de tener sentido cuando la cita cambia o termina."""
    db.execute(
        update(Notificacion)
        .where(Notificacion.cita_id == cita_id, Notificacion.estado == "pendiente")
        .values(estado="cancelada")
    )

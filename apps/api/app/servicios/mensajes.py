"""Admin-Mensajes: ver la bandeja de WhatsApp y reenviar lo que falló."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errores import ErrorApi, no_encontrado
from app.modelos import Cita, Cliente, EnlaceCita, Notificacion, Usuario
from app.servicios import auditoria, enlaces
from app.whatsapp.plantillas import CON_CODIGO

ESTADOS = ("pendiente", "enviada", "fallida", "cancelada")


def listar(
    db: Session, estado: str | None, limite: int, antes: int | None
) -> list[tuple[Notificacion, Cita, Cliente]]:
    """Lo más reciente primero; `antes` es el id de la última fila ya vista."""
    consulta = (
        select(Notificacion, Cita, Cliente)
        .join(Cita, Cita.id == Notificacion.cita_id)
        .join(Cliente, Cliente.id == Cita.cliente_id)
        .order_by(Notificacion.id.desc())
        .limit(limite)
    )
    if estado is not None:
        consulta = consulta.where(Notificacion.estado == estado)
    if antes is not None:
        consulta = consulta.where(Notificacion.id < antes)
    return [(n, c, cl) for n, c, cl in db.execute(consulta)]


def contar_fallidas(db: Session) -> int:
    return (
        db.scalar(
            select(func.count()).select_from(Notificacion).where(Notificacion.estado == "fallida")
        )
        or 0
    )


def _no_reenviable(mensaje: str) -> ErrorApi:
    return ErrorApi(409, "mensaje_no_reenviable", mensaje)


def reenviar(db: Session, admin: Usuario, notificacion_id: int, ahora: datetime) -> Notificacion:
    """Vuelve la fila a «pendiente» con la cuenta de intentos en cero; el worker la envía."""
    fila = db.get(Notificacion, notificacion_id)
    if fila is None:
        raise no_encontrado("No encontramos ese mensaje.")
    if fila.estado != "fallida":
        raise _no_reenviable("Solo se pueden reenviar los mensajes que fallaron.")
    cita = db.get(Cita, fila.cita_id)
    assert cita is not None
    if fila.tipo != "cancelacion" and (cita.estado != "agendada" or cita.inicio <= ahora):
        raise _no_reenviable("La cita ya no está agendada; el mensaje ya no tiene sentido.")

    variables = dict(fila.variables)
    if fila.plantilla in CON_CODIGO:
        # El token viejo se borró al fallar y solo existe su hash: se crea un enlace nuevo.
        enlace = db.scalars(select(EnlaceCita).where(EnlaceCita.cita_id == cita.id)).one_or_none()
        if enlace is None:
            raise _no_reenviable("La cita no tiene enlace para gestionar.")
        variables["token"] = enlaces.mover_enlace(enlace, cita, rotar=True)
    fila.variables = variables
    fila.estado = "pendiente"
    fila.intentos = 0
    fila.ultimo_error = None
    fila.enviar_en = ahora
    auditoria.registrar(
        db,
        admin.id,
        "mensaje_reenviado",
        "notificacion",
        fila.id,
        {"plantilla": fila.plantilla, "cita_id": cita.id},
    )
    db.commit()
    return fila

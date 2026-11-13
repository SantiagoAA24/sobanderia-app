"""Bandeja de salida: el worker toma una notificación a la vez y la envía.

`FOR UPDATE SKIP LOCKED` hace que dos workers nunca tomen la misma fila: el segundo se salta la
que el primero tiene bloqueada. Cada fila se procesa en su propia transacción, así el bloqueo dura
solo lo que tarda un envío. Si el proceso muere entre enviar y confirmar, la fila vuelve a quedar
pendiente y el mensaje puede salir dos veces; es preferible a perderlo.
"""

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import Cita, Cliente, Notificacion
from app.seguridad.celular import enmascarar
from app.whatsapp import ErrorEnvio, ErrorPermanente, ProveedorWhatsApp
from app.whatsapp.plantillas import armar_mensaje

registro = logging.getLogger("bandeja")


def _sin_token(variables: dict[str, Any]) -> dict[str, Any]:
    return {clave: valor for clave, valor in variables.items() if clave != "token"}


def _espera(intentos: int) -> timedelta:
    esperas = ajustes.worker_esperas_min
    return timedelta(minutes=esperas[min(intentos, len(esperas)) - 1])


def procesar_siguiente(db: Session, proveedor: ProveedorWhatsApp, ahora: datetime) -> bool:
    """Envía la primera notificación que ya le toca. Devuelve False si no había ninguna."""
    fila = db.scalars(
        select(Notificacion)
        .where(Notificacion.estado == "pendiente", Notificacion.enviar_en <= ahora)
        .order_by(Notificacion.enviar_en, Notificacion.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    ).first()
    if fila is None:
        db.rollback()
        return False

    cita = db.get(Cita, fila.cita_id)
    assert cita is not None
    cliente = db.get(Cliente, cita.cliente_id)
    assert cliente is not None

    # Un aviso de cancelación sale aunque la cita ya esté cancelada; los demás ya no tienen sentido.
    if fila.tipo != "cancelacion" and cita.estado != "agendada":
        fila.estado = "cancelada"
        fila.variables = _sin_token(fila.variables)
        db.commit()
        return True

    fila.intentos += 1
    try:
        token = fila.variables.get("token")
        mensaje = armar_mensaje(
            fila.plantilla,
            cliente.celular,
            fila.variables,
            token if isinstance(token, str) else None,
            fila.id,
        )
        fila.id_externo = proveedor.enviar_plantilla(mensaje)
    except ErrorEnvio as error:
        _registrar_fallo(fila, error, ahora)
    else:
        fila.estado = "enviada"
        fila.enviada_en = ahora
        fila.ultimo_error = None
        fila.variables = _sin_token(fila.variables)
        registro.info(
            "notificacion enviada id=%s plantilla=%s celular=%s",
            fila.id,
            fila.plantilla,
            enmascarar(cliente.celular),
        )
    db.commit()
    return True


def _registrar_fallo(fila: Notificacion, error: ErrorEnvio, ahora: datetime) -> None:
    fila.ultimo_error = str(error)[:500]
    definitivo = isinstance(error, ErrorPermanente) or fila.intentos >= ajustes.worker_intentos_max
    if definitivo:
        fila.estado = "fallida"
        fila.variables = _sin_token(fila.variables)  # el token no se guarda más de lo necesario
        registro.warning(
            "notificacion fallida id=%s plantilla=%s intentos=%s error=%s",
            fila.id,
            fila.plantilla,
            fila.intentos,
            fila.ultimo_error,
        )
    else:
        fila.enviar_en = ahora + _espera(fila.intentos)
        registro.warning(
            "notificacion reintento id=%s intento=%s error=%s",
            fila.id,
            fila.intentos,
            fila.ultimo_error,
        )


def vaciar(db: Session, proveedor: ProveedorWhatsApp, ahora: datetime) -> int:
    """Procesa todo lo que ya venció. Devuelve cuántas filas atendió."""
    atendidas = 0
    while procesar_siguiente(db, proveedor, ahora):
        atendidas += 1
    return atendidas

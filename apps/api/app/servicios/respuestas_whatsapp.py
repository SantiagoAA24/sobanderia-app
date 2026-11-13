"""Lo que Meta cuenta por el webhook: estados de entrega y respuestas de los clientes.

Las respuestas salen como texto libre, que Meta solo permite dentro de la ventana de 24 horas
que abre el cliente al escribir o tocar un botón. El texto de cada una está en `docs/GUIA.md`.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import Cita, Cliente, EnlaceCita, Notificacion
from app.seguridad.celular import enmascarar
from app.servicios import enlaces
from app.whatsapp import ErrorEnvio, ProveedorWhatsApp
from app.whatsapp.plantillas import RESPUESTA_ASISTIRE, RESPUESTA_CAMBIAR

registro = logging.getLogger("webhook.whatsapp")


def procesar(db: Session, carga: object, proveedor: ProveedorWhatsApp, ahora: datetime) -> None:
    """Recorre la carga de Meta. Lo que no entiende lo ignora: Meta reintenta si no hay 200."""
    for valor in _valores(carga):
        for estado in _lista(valor.get("statuses")):
            _guardar_estado(db, estado, ahora)
        db.commit()
        for mensaje in _lista(valor.get("messages")):
            _responder(db, mensaje, proveedor, ahora)


def _valores(carga: object) -> list[dict[str, Any]]:
    valores: list[dict[str, Any]] = []
    if not isinstance(carga, dict):
        return valores
    for entrada in _lista(carga.get("entry")):
        for cambio in _lista(entrada.get("changes")):
            valor = cambio.get("value")
            if isinstance(valor, dict):
                valores.append(valor)
    return valores


def _lista(valor: object) -> list[dict[str, Any]]:
    if not isinstance(valor, list):
        return []
    return [elemento for elemento in valor if isinstance(elemento, dict)]


# --- Estados de entrega -----------------------------------------------------------------


def _momento(texto: object, ahora: datetime) -> datetime:
    try:
        return datetime.fromtimestamp(int(str(texto)), UTC)
    except (ValueError, OverflowError, OSError):
        return ahora


def _guardar_estado(db: Session, estado: dict[str, Any], ahora: datetime) -> None:
    id_externo = estado.get("id")
    if not isinstance(id_externo, str):
        return
    fila = db.scalars(select(Notificacion).where(Notificacion.id_externo == id_externo)).first()
    if fila is None:
        return
    momento = _momento(estado.get("timestamp"), ahora)
    tipo = estado.get("status")
    if tipo == "delivered" and fila.entregada_en is None:
        fila.entregada_en = momento
    elif tipo == "read":
        if fila.leida_en is None:
            fila.leida_en = momento
        if fila.entregada_en is None:  # a veces Meta salta directo a «read»
            fila.entregada_en = momento
    elif tipo == "failed" and fila.estado == "enviada":
        fila.estado = "fallida"
        fila.ultimo_error = f"Meta informó que no se entregó (código {_codigo_error(estado)})"
        registro.warning("entrega fallida id=%s error=%s", fila.id, fila.ultimo_error)


def _codigo_error(estado: dict[str, Any]) -> str:
    errores = _lista(estado.get("errors"))
    return str(errores[0].get("code", "?")) if errores else "?"


# --- Respuestas de los clientes ---------------------------------------------------------


def _responder(
    db: Session, mensaje: dict[str, Any], proveedor: ProveedorWhatsApp, ahora: datetime
) -> None:
    origen = mensaje.get("from")
    if not isinstance(origen, str) or not origen.isdigit():
        return
    celular = f"+{origen}"
    boton = mensaje.get("button")
    if mensaje.get("type") == "button" and isinstance(boton, dict):
        texto = _responder_boton(db, str(boton.get("payload", "")), celular, ahora)
    else:
        texto = _responder_texto(db, celular, ahora)
    if texto is None:
        db.rollback()
        return
    try:
        proveedor.enviar_texto(celular, texto)
    except ErrorEnvio as error:
        db.rollback()  # si el mensaje no salió, el enlace anterior sigue sirviendo
        registro.warning("respuesta sin enviar celular=%s error=%s", enmascarar(celular), error)
        return
    db.commit()
    registro.info("respuesta enviada celular=%s", enmascarar(celular))


def _responder_boton(db: Session, payload: str, celular: str, ahora: datetime) -> str | None:
    accion, _, texto_id = payload.partition(":")
    if accion not in (RESPUESTA_ASISTIRE, RESPUESTA_CAMBIAR) or not texto_id.isdigit():
        return None
    fila = db.get(Notificacion, int(texto_id))
    if fila is None:
        return None
    cita = db.get(Cita, fila.cita_id)
    cliente = db.get(Cliente, cita.cliente_id) if cita else None
    # Solo quien recibió el mensaje puede contestarlo: el número debe ser el del cliente.
    if cita is None or cliente is None or cliente.celular != celular:
        return None
    if accion == RESPUESTA_ASISTIRE:
        return f"Gracias, {cliente.nombre}. Lo esperamos."
    enlace = _enlace_nuevo(db, cita, ahora)
    if enlace is None:
        return f"Con gusto. Para agendar otra cita, entre aquí: {ajustes.origen_web}"
    return f"Con gusto. Elija otro día u hora aquí: {enlace}"


def _responder_texto(db: Session, celular: str, ahora: datetime) -> str:
    cliente = db.scalars(select(Cliente).where(Cliente.celular == celular)).first()
    proxima = _proxima_cita(db, cliente, ahora) if cliente else None
    enlace = _enlace_nuevo(db, proxima, ahora) if proxima else None
    if enlace is None:
        return (
            "Gracias por escribirnos. Para agendar una cita, entre aquí: "
            f"{ajustes.origen_web}. Si prefiere, llámenos."
        )
    return (
        f"Gracias por escribirnos. Para cambiar o cancelar su cita, entre aquí: {enlace}. "
        "Si prefiere, llámenos."
    )


def _proxima_cita(db: Session, cliente: Cliente, ahora: datetime) -> Cita | None:
    agendadas = db.scalars(
        select(Cita).where(Cita.cliente_id == cliente.id, Cita.estado == "agendada")
    ).all()
    futuras = sorted((c for c in agendadas if c.inicio > ahora), key=lambda c: c.inicio)
    return futuras[0] if futuras else None


def _enlace_nuevo(db: Session, cita: Cita, ahora: datetime) -> str | None:
    """Rota el enlace de la cita (el token solo se guarda como hash) y arma la dirección."""
    if cita.estado != "agendada" or cita.inicio <= ahora:
        return None
    enlace = db.scalars(select(EnlaceCita).where(EnlaceCita.cita_id == cita.id)).one_or_none()
    if enlace is None:
        return None
    token = enlaces.mover_enlace(enlace, cita, rotar=True)
    return f"{ajustes.origen_web}/mi-cita/{token}"

"""Crear, reprogramar, cancelar y cerrar citas.

La restricción `citas_sin_cruce` decide quién se queda con una hora; aquí solo se traduce su
error a `hora_ocupada`. Cada cambio escribe su notificación en la misma transacción.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import ajustes
from app.errores import ErrorApi, cita_no_modificable, hora_ocupada
from app.modelos import Cita, Cliente, EnlaceCita, Sobandero
from app.seguridad.celular import enmascarar, normalizar_celular
from app.servicios import bajas, enlaces, notificaciones
from app.servicios.horas import alternativas, dia_local, horas_libres

registro = logging.getLogger("sobanderia.citas")


def _es_cruce(error: IntegrityError) -> bool:
    return getattr(getattr(error.orig, "diag", None), "constraint_name", None) == "citas_sin_cruce"


def obtener_o_crear_cliente(
    db: Session, nombre: str, celular: str, ahora: datetime, consentimiento: bool
) -> Cliente:
    """Busca por celular normalizado; si existe se reutiliza y no se pisa su nombre."""
    numero = normalizar_celular(celular)
    # ON CONFLICT: dos solicitudes con el mismo celular nuevo no chocan entre sí.
    db.execute(
        pg_insert(Cliente)
        .values(nombre=nombre, celular=numero)
        .on_conflict_do_nothing(index_elements=["celular"])
    )
    cliente = db.scalars(select(Cliente).where(Cliente.celular == numero)).one()
    if consentimiento:
        cliente.politica_aceptada_en = ahora
        cliente.politica_version = ajustes.politica_version
    return cliente


def _rango(inicio: datetime, minutos: int) -> Range[datetime]:
    return Range(inicio, inicio + timedelta(minutes=minutos), bounds="[)")


def _ocupada(
    db: Session, sobandero: Sobandero, pedida: datetime, ahora: datetime, excluir: int | None = None
) -> ErrorApi:
    return hora_ocupada(alternativas(db, sobandero, pedida, ahora, excluir_cita_id=excluir))


def _crear(
    db: Session,
    sobandero: Sobandero,
    cliente: Cliente,
    inicio: datetime,
    origen: str,
    ahora: datetime,
    antelacion_min: int,
) -> Cita:
    if inicio not in horas_libres(db, sobandero, dia_local(inicio), ahora, antelacion_min):
        raise _ocupada(db, sobandero, inicio, ahora)
    cita = Cita(
        sobandero_id=sobandero.id,
        cliente_id=cliente.id,
        rango=_rango(inicio, sobandero.duracion_min),
        origen=origen,
    )
    try:
        with db.begin_nested():
            db.add(cita)
            db.flush()
    except IntegrityError as error:
        if not _es_cruce(error):
            raise
        raise _ocupada(db, sobandero, inicio, ahora) from error
    return cita


def crear_cita(
    db: Session,
    sobandero: Sobandero,
    nombre: str,
    celular: str,
    inicio: datetime,
    ahora: datetime,
    origen: str,
    consentimiento: bool = False,
) -> tuple[Cita, Cliente, str]:
    """Crea la cita, su enlace y su notificación de confirmación. Devuelve el token del enlace."""
    if origen == "cliente" and not consentimiento:
        raise ErrorApi(422, "validacion", "Debe aceptar el uso de sus datos para continuar.")
    cliente = obtener_o_crear_cliente(db, nombre, celular, ahora, consentimiento)
    # Una cita manual puede ser para dentro de poco; el cliente por internet necesita antelación.
    antelacion = ajustes.antelacion_min if origen == "cliente" else 0
    cita = _crear(db, sobandero, cliente, inicio, origen, ahora, antelacion)
    token = enlaces.crear_enlace(db, cita)
    notificaciones.encolar(
        db, cita, cliente, sobandero, "confirmacion", "cita_confirmada", ahora, token
    )
    notificaciones.encolar_recordatorio(db, cita, cliente, sobandero, ahora)
    db.commit()
    registro.info(
        "cita creada id=%s origen=%s celular=%s", cita.id, origen, enmascarar(cliente.celular)
    )
    return cita, cliente, token


def _exigir_modificable(cita: Cita, ahora: datetime) -> None:
    if cita.estado != "agendada" or cita.inicio <= ahora:
        raise cita_no_modificable()


def reprogramar(
    db: Session,
    cita: Cita,
    nuevo_inicio: datetime,
    ahora: datetime,
    por: str,
    avisar: bool = True,
    token: str | None = None,
) -> tuple[Cita, str | None]:
    """Crea la cita nueva y libera la vieja en una sola transacción.

    Si la hora nueva se ocupa, no cambia nada. `token` es el del enlace que usó el cliente; si
    cambia el sobandero y avisa, el enlace se rota para poder ponerlo en el mensaje.
    """
    _exigir_modificable(cita, ahora)
    sobandero = db.get(Sobandero, cita.sobandero_id)
    cliente = db.get(Cliente, cita.cliente_id)
    enlace = db.scalars(select(EnlaceCita).where(EnlaceCita.cita_id == cita.id)).one_or_none()
    assert sobandero is not None and cliente is not None

    antelacion = ajustes.antelacion_min if por == "cliente" else 0
    libres = horas_libres(db, sobandero, dia_local(nuevo_inicio), ahora, antelacion, cita.id)
    if nuevo_inicio not in libres:
        raise _ocupada(db, sobandero, nuevo_inicio, ahora, cita.id)

    nueva = Cita(
        sobandero_id=sobandero.id,
        cliente_id=cliente.id,
        rango=_rango(nuevo_inicio, sobandero.duracion_min),
        origen=cita.origen,
    )
    try:
        with db.begin_nested():
            cita.estado = "cancelada"
            cita.cancelada_por = por
            db.flush()
            db.add(nueva)
            db.flush()
    except IntegrityError as error:
        if not _es_cruce(error):
            raise
        raise _ocupada(db, sobandero, nuevo_inicio, ahora, cita.id) from error

    notificaciones.cancelar_pendientes(db, cita.id)
    if enlace is None:  # citas sin enlace (no debería pasar): se crea uno para la nueva
        rotado: str | None = enlaces.crear_enlace(db, nueva)
    else:
        rotado = enlaces.mover_enlace(enlace, nueva, rotar=por == "sobandero" and avisar)
    token_final = rotado or token
    if avisar:
        notificaciones.encolar(
            db, nueva, cliente, sobandero, "reprogramacion", "cita_cambiada", ahora, token_final
        )
    notificaciones.encolar_recordatorio(db, nueva, cliente, sobandero, ahora)
    db.commit()
    registro.info("cita reprogramada id=%s nueva=%s por=%s", cita.id, nueva.id, por)
    return nueva, token_final


def cancelar_sin_guardar(
    db: Session, cita: Cita, ahora: datetime, por: str, avisar: bool = True
) -> Cita:
    """Cancela y encola el aviso sin cerrar la transacción (la baja cancela varias citas)."""
    _exigir_modificable(cita, ahora)
    cita.estado = "cancelada"
    cita.cancelada_por = por
    notificaciones.cancelar_pendientes(db, cita.id)
    if avisar:
        sobandero = db.get(Sobandero, cita.sobandero_id)
        cliente = db.get(Cliente, cita.cliente_id)
        assert sobandero is not None and cliente is not None
        plantilla = "cita_cancelada" if por == "cliente" else "cita_cancelada_sobandero"
        notificaciones.encolar(db, cita, cliente, sobandero, "cancelacion", plantilla, ahora)
    return cita


def cancelar(db: Session, cita: Cita, ahora: datetime, por: str, avisar: bool = True) -> Cita:
    cancelar_sin_guardar(db, cita, ahora, por, avisar)
    bajas.revisar_baja(db, cita.sobandero_id)
    db.commit()
    registro.info("cita cancelada id=%s por=%s", cita.id, por)
    return cita


def cerrar(db: Session, cita: Cita, estado: str) -> Cita:
    """Marca atendida o no asistió. No avisa al cliente."""
    if cita.estado != "agendada":
        raise cita_no_modificable()
    cita.estado = estado
    notificaciones.cancelar_pendientes(db, cita.id)
    bajas.revisar_baja(db, cita.sobandero_id)
    db.commit()
    return cita

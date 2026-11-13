"""Catálogo de las seis plantillas aprobadas en Meta y cómo se arma cada mensaje.

Meta exige variables consecutivas ({{1}}, {{2}}...) en el cuerpo de cada plantilla, por eso el
orden se declara por plantilla y no es el mismo en todas. El texto de cada una está en
`docs/WHATSAPP.md`.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

from app.whatsapp.proveedor import ErrorPermanente, Mensaje

TipoBoton = Literal["enlace_con_codigo", "enlace_fijo", "respuestas"]

CLIENTE, SOBANDERO, DIA, HORA = "nombre", "sobandero", "dia", "hora"


@dataclass(frozen=True)
class Plantilla:
    nombre: str
    variables: tuple[str, ...]  # claves de `notificaciones.variables`, en el orden {{1}}, {{2}}...
    boton: TipoBoton


_COMPLETA = (CLIENTE, SOBANDERO, DIA, HORA)
_SIN_SOBANDERO = (CLIENTE, DIA, HORA)

PLANTILLAS: dict[str, Plantilla] = {
    p.nombre: p
    for p in (
        Plantilla("cita_confirmada", _COMPLETA, "enlace_con_codigo"),
        Plantilla("recordatorio_cita", _COMPLETA, "respuestas"),
        Plantilla("cita_cambiada", _COMPLETA, "enlace_con_codigo"),
        Plantilla("cita_cancelada", _SIN_SOBANDERO, "enlace_fijo"),
        Plantilla("cita_cancelada_sobandero", _COMPLETA, "enlace_fijo"),
        Plantilla("enlace_cita", _SIN_SOBANDERO, "enlace_con_codigo"),
    )
}

# Plantillas cuyo botón lleva el código de la cita (el worker borra el token al enviar).
CON_CODIGO = frozenset(p.nombre for p in PLANTILLAS.values() if p.boton == "enlace_con_codigo")

RESPUESTA_ASISTIRE = "asistire"
RESPUESTA_CAMBIAR = "cambiar"


def armar_mensaje(
    plantilla: str,
    celular: str,
    variables: Mapping[str, object],
    token: str | None,
    referencia: int,
) -> Mensaje:
    """`referencia` es el id de la notificación: vuelve en el webhook cuando se toca un botón."""
    definicion = PLANTILLAS.get(plantilla)
    if definicion is None:
        raise ErrorPermanente(f"plantilla desconocida: {plantilla}")
    try:
        parametros = tuple(str(variables[clave]) for clave in definicion.variables)
    except KeyError as error:
        raise ErrorPermanente(f"falta la variable {error.args[0]} de {plantilla}") from error
    codigo: str | None = None
    if definicion.boton == "enlace_con_codigo":
        if not token:
            raise ErrorPermanente(f"{plantilla} necesita el código del enlace")
        codigo = token
    payloads: tuple[str, ...] = ()
    if definicion.boton == "respuestas":
        payloads = (f"{RESPUESTA_ASISTIRE}:{referencia}", f"{RESPUESTA_CAMBIAR}:{referencia}")
    return Mensaje(
        celular=celular,
        plantilla=plantilla,
        parametros=parametros,
        codigo_enlace=codigo,
        payloads=payloads,
    )

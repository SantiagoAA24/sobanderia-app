"""Formas de entrada y salida compartidas por las rutas de citas."""

from datetime import date, datetime
from typing import Annotated, Any

from pydantic import AwareDatetime, BaseModel, StringConstraints

Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Celular = Annotated[str, StringConstraints(strip_whitespace=True, min_length=7, max_length=30)]


class ErrorOut(BaseModel):
    codigo: str
    mensaje: str


class HoraOcupadaOut(ErrorOut):
    alternativas: list[datetime]


Respuestas = dict[int | str, dict[str, Any]]

ERRORES_AGENDA: Respuestas = {
    409: {"model": HoraOcupadaOut, "description": "`hora_ocupada` con hasta 3 alternativas"},
    422: {"model": ErrorOut, "description": "`validacion`"},
}

SESION: Respuestas = {401: {"model": ErrorOut}, 403: {"model": ErrorOut}}
NO_ENCONTRADO: Respuestas = {404: {"model": ErrorOut}}
VENCIDO: Respuestas = {410: {"model": ErrorOut, "description": "`enlace_vencido`"}}
NO_MODIFICABLE: Respuestas = {409: {"model": ErrorOut, "description": "`cita_no_modificable`"}}


class SobanderoOut(BaseModel):
    id: int
    nombre: str
    duracion_min: int


class SobanderoPublicoOut(SobanderoOut):
    """Con su próximo cupo, para el Paso 1. Es nulo si no tiene horas libres."""

    proximo_cupo: AwareDatetime | None


class NegocioOut(BaseModel):
    nombre: str
    direccion: str
    telefono: str
    mensaje_bienvenida: str


class EncontrarCitaIn(BaseModel):
    celular: Celular


class EnlaceEnviadoOut(BaseModel):
    """Siempre la misma respuesta, exista o no la cita."""

    enviado: bool = True


class DiasOut(BaseModel):
    dias: list[date]


class HorasOut(BaseModel):
    dia: date
    duracion_min: int
    horas: list[AwareDatetime]


class CitaClienteOut(BaseModel):
    """Lo que ve el cliente de su cita."""

    estado: str
    inicio: datetime
    fin: datetime
    duracion_min: int
    sobandero: SobanderoOut
    cliente_nombre: str
    puede_modificar: bool


class CitaCreadaOut(BaseModel):
    token: str
    cita: CitaClienteOut


class ReprogramarIn(BaseModel):
    inicio: AwareDatetime

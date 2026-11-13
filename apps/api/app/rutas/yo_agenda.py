"""Horas libres, horario semanal y bloqueos de quien ingresó. Todo es solo suyo."""

from datetime import date, datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import AwareDatetime, BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session

from app.db import obtener_sesion
from app.errores import ErrorApi, no_encontrado
from app.modelos import Bloqueo, Sobandero
from app.reloj import Ahora
from app.rutas.esquemas import (
    NO_ENCONTRADO,
    SESION,
    DiasOut,
    ErrorOut,
    HorasOut,
    Respuestas,
)
from app.seguridad.dependencias import sobandero_actual
from app.servicios import horario as servicio
from app.servicios.horas import dias_con_horas, horas_libres

router = APIRouter(prefix="/yo", tags=["sobandero"])
Db = Annotated[Session, Depends(obtener_sesion)]
Yo = Annotated[Sobandero, Depends(sobandero_actual)]
Invalido: Respuestas = {422: {"model": ErrorOut, "description": "`validacion`"}}

HoraTexto = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]


class FranjaIO(BaseModel):
    """Hora de pared de Bogotá, «HH:MM»."""

    desde: HoraTexto
    hasta: HoraTexto


class DiaHorarioIO(BaseModel):
    """`dia_semana`: 0 = lunes ... 6 = domingo. Sin franjas, ese día no atiende."""

    dia_semana: int = Field(ge=0, le=6)
    franjas: list[FranjaIO]


class HorarioIn(BaseModel):
    dias: list[DiaHorarioIO]


class HorarioOut(BaseModel):
    duracion_min: int
    dias: list[DiaHorarioIO]


class BloqueoIn(BaseModel):
    inicio: AwareDatetime
    fin: AwareDatetime
    motivo: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None


class BloqueoOut(BaseModel):
    id: int
    inicio: datetime
    fin: datetime
    motivo: str | None
    citas_afectadas: int


def _hora(texto: str) -> time:
    return time.fromisoformat(texto)


def _texto(hora: time) -> str:
    return hora.strftime("%H:%M")


def _horario_out(yo: Sobandero, dias: dict[int, list[tuple[time, time]]]) -> HorarioOut:
    return HorarioOut(
        duracion_min=yo.duracion_min,
        dias=[
            DiaHorarioIO(
                dia_semana=dia,
                franjas=[FranjaIO(desde=_texto(d), hasta=_texto(h)) for d, h in dias[dia]],
            )
            for dia in range(7)
        ],
    )


def _bloqueo_out(db: Session, yo: Sobandero, bloqueo: Bloqueo) -> BloqueoOut:
    inicio, fin = bloqueo.rango.lower, bloqueo.rango.upper
    assert inicio is not None and fin is not None
    return BloqueoOut(
        id=bloqueo.id,
        inicio=inicio,
        fin=fin,
        motivo=bloqueo.motivo,
        citas_afectadas=servicio.citas_en_rango(db, yo.id, inicio, fin),
    )


@router.get("/dias", responses=SESION)
def dias(db: Db, yo: Yo, ahora: Ahora) -> DiasOut:
    """Días con horas libres, sin la antelación que se exige al cliente."""
    return DiasOut(dias=dias_con_horas(db, yo, ahora))


@router.get("/horas", responses=SESION)
def horas(db: Db, yo: Yo, ahora: Ahora, dia: date, excluir_cita: int | None = None) -> HorasOut:
    """Horas libres de un día. Al cambiar una cita, `excluir_cita` libera su propia hora."""
    libres = horas_libres(db, yo, dia, ahora, excluir_cita_id=excluir_cita)
    return HorasOut(dia=dia, duracion_min=yo.duracion_min, horas=libres)


@router.get("/horario", responses=SESION)
def ver_horario(db: Db, yo: Yo) -> HorarioOut:
    return _horario_out(yo, servicio.horario_semanal(db, yo))


@router.put("/horario", responses=SESION | Invalido)
def guardar_horario(datos: HorarioIn, db: Db, yo: Yo) -> HorarioOut:
    """Reemplaza las franjas de los días enviados. No toca las citas ya agendadas."""
    vistos = [d.dia_semana for d in datos.dias]
    if len(set(vistos)) != len(vistos):
        raise ErrorApi(422, "validacion", "Cada día puede aparecer una sola vez.")
    nuevo = {
        d.dia_semana: [(_hora(f.desde), _hora(f.hasta)) for f in d.franjas] for d in datos.dias
    }
    return _horario_out(yo, servicio.guardar_horario(db, yo, nuevo))


@router.get("/bloqueos", responses=SESION)
def listar_bloqueos(db: Db, yo: Yo, ahora: Ahora) -> list[BloqueoOut]:
    return [_bloqueo_out(db, yo, b) for b in servicio.bloqueos_vigentes(db, yo, ahora)]


@router.post("/bloqueos", status_code=201, responses=SESION | Invalido)
def crear_bloqueo(datos: BloqueoIn, db: Db, yo: Yo, ahora: Ahora) -> BloqueoOut:
    """Las citas ya agendadas en el rango no se cancelan: `citas_afectadas` dice cuántas hay."""
    bloqueo = servicio.crear_bloqueo(db, yo, datos.inicio, datos.fin, datos.motivo, ahora)
    return _bloqueo_out(db, yo, bloqueo)


@router.delete("/bloqueos/{bloqueo_id}", status_code=204, responses=SESION | NO_ENCONTRADO)
def quitar_bloqueo(bloqueo_id: int, db: Db, yo: Yo) -> Response:
    bloqueo = db.get(Bloqueo, bloqueo_id)
    if bloqueo is None or bloqueo.sobandero_id != yo.id:
        raise no_encontrado("No encontramos ese bloqueo.")
    db.delete(bloqueo)
    db.commit()
    return Response(status_code=204)

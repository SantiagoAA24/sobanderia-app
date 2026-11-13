from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import AwareDatetime, BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import ajustes
from app.db import obtener_sesion
from app.errores import no_encontrado
from app.modelos import Negocio, Sobandero, Usuario
from app.reloj import Ahora
from app.rutas.esquemas import (
    ERRORES_AGENDA,
    NO_ENCONTRADO,
    Celular,
    CitaCreadaOut,
    DiasOut,
    EncontrarCitaIn,
    EnlaceEnviadoOut,
    ErrorOut,
    HorasOut,
    NegocioOut,
    Nombre,
    SobanderoPublicoOut,
)
from app.seguridad.dependencias import exige_csrf
from app.servicios import citas as servicio
from app.servicios.encontrar_cita import enviar_enlace
from app.servicios.horas import dias_con_horas, horas_libres, proximo_cupo
from app.servicios.vistas import vista_cliente

router = APIRouter(prefix="/publico", tags=["publico"])
Db = Annotated[Session, Depends(obtener_sesion)]


class CrearCitaIn(BaseModel):
    sobandero_id: int
    inicio: AwareDatetime
    nombre: Nombre
    celular: Celular
    consentimiento: bool


def _sobandero(db: Session, sobandero_id: int) -> Sobandero:
    sobandero = db.scalar(
        select(Sobandero)
        .join(Usuario, Usuario.id == Sobandero.usuario_id)
        .where(Sobandero.id == sobandero_id, Sobandero.recibe_citas, Usuario.activo)
    )
    if sobandero is None:
        raise no_encontrado("No encontramos a ese sobandero.")
    return sobandero


@router.get("/negocio", responses=NO_ENCONTRADO)
def negocio(db: Db) -> NegocioOut:
    fila = db.get(Negocio, 1)
    if fila is None:
        raise no_encontrado("No encontramos los datos del local.")
    return NegocioOut(
        nombre=fila.nombre,
        direccion=fila.direccion,
        telefono=fila.telefono,
        mensaje_bienvenida=fila.mensaje_bienvenida,
    )


@router.get("/sobanderos")
def listar_sobanderos(db: Db, ahora: Ahora) -> list[SobanderoPublicoOut]:
    filas = db.scalars(
        select(Sobandero)
        .join(Usuario, Usuario.id == Sobandero.usuario_id)
        .where(Sobandero.recibe_citas, Usuario.activo)
        .order_by(Sobandero.id)
    )
    return [
        SobanderoPublicoOut(
            id=s.id,
            nombre=s.usuario.nombre,
            duracion_min=s.duracion_min,
            proximo_cupo=proximo_cupo(db, s, ahora, ajustes.antelacion_min),
        )
        for s in filas
    ]


@router.get("/sobanderos/{sobandero_id}/dias", responses=NO_ENCONTRADO)
def dias(sobandero_id: int, db: Db, ahora: Ahora) -> DiasOut:
    sobandero = _sobandero(db, sobandero_id)
    return DiasOut(dias=dias_con_horas(db, sobandero, ahora, antelacion_min=ajustes.antelacion_min))


@router.get("/sobanderos/{sobandero_id}/horas", responses=NO_ENCONTRADO)
def horas(sobandero_id: int, dia: date, db: Db, ahora: Ahora) -> HorasOut:
    sobandero = _sobandero(db, sobandero_id)
    libres = horas_libres(db, sobandero, dia, ahora, ajustes.antelacion_min)
    return HorasOut(dia=dia, duracion_min=sobandero.duracion_min, horas=libres)


@router.post(
    "/citas",
    status_code=201,
    dependencies=[Depends(exige_csrf)],
    responses=ERRORES_AGENDA | NO_ENCONTRADO,
)
def crear_cita(datos: CrearCitaIn, db: Db, ahora: Ahora) -> CitaCreadaOut:
    sobandero = _sobandero(db, datos.sobandero_id)
    cita, _, token = servicio.crear_cita(
        db,
        sobandero,
        datos.nombre,
        datos.celular,
        datos.inicio,
        ahora,
        origen="cliente",
        consentimiento=datos.consentimiento,
    )
    return CitaCreadaOut(token=token, cita=vista_cliente(db, cita, ahora))


@router.post(
    "/mi-cita/enlace",
    status_code=202,
    dependencies=[Depends(exige_csrf)],
    responses={
        422: {"model": ErrorOut, "description": "`validacion`"},
        429: {"model": ErrorOut, "description": "`demasiados_intentos`"},
    },
)
def pedir_enlace(
    datos: EncontrarCitaIn, request: Request, db: Db, ahora: Ahora
) -> EnlaceEnviadoOut:
    """Responde igual exista o no la cita para no revelar quién tiene una."""
    ip = request.client.host if request.client else "desconocida"
    enviar_enlace(db, datos.celular, ip, ahora)
    return EnlaceEnviadoOut()

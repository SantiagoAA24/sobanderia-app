from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import obtener_sesion
from app.reloj import Ahora
from app.rutas.esquemas import (
    ERRORES_AGENDA,
    NO_MODIFICABLE,
    VENCIDO,
    CitaClienteOut,
    ReprogramarIn,
)
from app.seguridad.dependencias import exige_csrf
from app.servicios import citas as servicio
from app.servicios import enlaces
from app.servicios.vistas import vista_cliente

router = APIRouter(prefix="/mi-cita", tags=["mi-cita"])
Db = Annotated[Session, Depends(obtener_sesion)]


@router.get("/{token}", responses=VENCIDO)
def ver(token: str, db: Db, ahora: Ahora) -> CitaClienteOut:
    cita, _ = enlaces.cita_por_token(db, token, ahora)
    return vista_cliente(db, cita, ahora)


@router.post(
    "/{token}/reprogramar",
    dependencies=[Depends(exige_csrf)],
    responses=VENCIDO | ERRORES_AGENDA,
)
def reprogramar(token: str, datos: ReprogramarIn, db: Db, ahora: Ahora) -> CitaClienteOut:
    cita, _ = enlaces.cita_por_token(db, token, ahora)
    nueva, _ = servicio.reprogramar(db, cita, datos.inicio, ahora, por="cliente", token=token)
    return vista_cliente(db, nueva, ahora)


@router.post(
    "/{token}/cancelar",
    dependencies=[Depends(exige_csrf)],
    responses=VENCIDO | NO_MODIFICABLE,
)
def cancelar(token: str, db: Db, ahora: Ahora) -> CitaClienteOut:
    cita, _ = enlaces.cita_por_token(db, token, ahora)
    servicio.cancelar(db, cita, ahora, por="cliente")
    return vista_cliente(db, cita, ahora)

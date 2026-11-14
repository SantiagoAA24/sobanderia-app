"""Perfil de quien ingresó: ver y cambiar nombre o correo."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.correo import EnviadorCorreo, obtener_enviador
from app.db import obtener_sesion
from app.errores import ErrorApi
from app.modelos import Sobandero
from app.rutas.esquemas import SESION, CorreoTexto, ErrorOut, Nombre
from app.seguridad.dependencias import sobandero_actual
from app.seguridad.ip import ip_del_cliente
from app.servicios import perfil as servicio

router = APIRouter(prefix="/yo/perfil", tags=["sobandero"])
Db = Annotated[Session, Depends(obtener_sesion)]
Yo = Annotated[Sobandero, Depends(sobandero_actual)]
Correo = Annotated[EnviadorCorreo, Depends(obtener_enviador)]


class PerfilOut(BaseModel):
    nombre: str
    correo: str
    duracion_min: int


class PerfilIn(BaseModel):
    nombre: Nombre | None = None
    correo: CorreoTexto | None = None
    clave_actual: str | None = None


def _salida(yo: Sobandero) -> PerfilOut:
    return PerfilOut(
        nombre=yo.usuario.nombre, correo=yo.usuario.correo, duracion_min=yo.duracion_min
    )


@router.get("", responses=SESION)
def ver(yo: Yo) -> PerfilOut:
    return _salida(yo)


@router.patch(
    "",
    responses=SESION
    | {
        409: {"model": ErrorOut, "description": "`correo_en_uso`"},
        422: {"model": ErrorOut, "description": "`validacion`"},
    },
)
def cambiar(datos: PerfilIn, request: Request, db: Db, yo: Yo, correo: Correo) -> PerfilOut:
    """El correo pide la clave actual (401 `clave_incorrecta` si no coincide)."""
    if datos.nombre is None and datos.correo is None:
        raise ErrorApi(422, "validacion", "No hay nada que cambiar.")
    servicio.actualizar(
        db,
        correo,
        yo.usuario,
        datos.nombre,
        datos.correo,
        datos.clave_actual,
        ip_del_cliente(request),
    )
    return _salida(yo)

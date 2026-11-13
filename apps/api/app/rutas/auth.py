from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import ajustes
from app.correo import EnviadorCorreo, obtener_enviador
from app.db import obtener_sesion
from app.modelos import Usuario
from app.seguridad.dependencias import (
    exige_csrf,
    sesion_activa,
    token_de_cookie,
)
from app.servicios import auth as servicio

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(exige_csrf)])

Db = Annotated[Session, Depends(obtener_sesion)]
Correo = Annotated[EnviadorCorreo, Depends(obtener_enviador)]
Token = Annotated[str | None, Depends(token_de_cookie)]


class IngresoIn(BaseModel):
    correo: str = Field(min_length=3, max_length=254)
    clave: str = Field(min_length=1, max_length=128)


class UsuarioOut(BaseModel):
    nombre: str
    rol: Literal["sobandero", "admin"]
    debe_cambiar_clave: bool


class CambiarClaveIn(BaseModel):
    clave_actual: str = Field(min_length=1, max_length=128)
    clave_nueva: str = Field(min_length=1, max_length=128)


class RecuperarIn(BaseModel):
    correo: str = Field(min_length=3, max_length=254)


class RestablecerIn(BaseModel):
    token: str = Field(min_length=1, max_length=200)
    clave_nueva: str = Field(min_length=1, max_length=128)


class MensajeOut(BaseModel):
    mensaje: str


def _salida(usuario: Usuario) -> UsuarioOut:
    return UsuarioOut(
        nombre=usuario.nombre, rol=usuario.rol, debe_cambiar_clave=usuario.debe_cambiar_clave
    )


def _ip(request: Request) -> str:
    return request.client.host if request.client else "desconocida"


@router.post("/ingreso")
def ingreso(datos: IngresoIn, request: Request, response: Response, db: Db) -> UsuarioOut:
    usuario, token = servicio.ingresar(db, datos.correo, datos.clave, _ip(request))
    response.set_cookie(
        ajustes.cookie_sesion,
        token,
        max_age=ajustes.sesion_maxima_dias * 86400,
        httponly=True,
        samesite="lax",
        secure=ajustes.cookie_segura,
        path="/",
    )
    return _salida(usuario)


@router.post("/salida", status_code=204)
def salida(db: Db, token: Token) -> Response:
    servicio.salir(db, token)
    respuesta = Response(status_code=204)
    respuesta.delete_cookie(ajustes.cookie_sesion, path="/")
    return respuesta


@router.get("/yo")
def yo(usuario: Annotated[Usuario, Depends(sesion_activa)]) -> UsuarioOut:
    return _salida(usuario)


@router.post("/cambiar-clave", status_code=204)
def cambiar_clave(
    datos: CambiarClaveIn,
    db: Db,
    correo: Correo,
    token: Token,
    usuario: Annotated[Usuario, Depends(sesion_activa)],
) -> Response:
    servicio.cambiar_clave(db, correo, usuario, token or "", datos.clave_actual, datos.clave_nueva)
    return Response(status_code=204)


@router.post("/recuperar")
def recuperar(datos: RecuperarIn, request: Request, db: Db, correo: Correo) -> MensajeOut:
    servicio.pedir_recuperacion(db, correo, datos.correo, _ip(request))
    return MensajeOut(mensaje="Si el correo está registrado, le enviamos un enlace.")


@router.post("/restablecer", status_code=204)
def restablecer(datos: RestablecerIn, db: Db, correo: Correo) -> Response:
    servicio.restablecer_clave(db, correo, datos.token, datos.clave_nueva)
    return Response(status_code=204)

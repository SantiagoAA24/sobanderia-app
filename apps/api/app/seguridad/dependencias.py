"""Dependencias de FastAPI: CSRF, sesión y roles. El rol se verifica aquí, en el servidor."""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import ajustes
from app.db import obtener_sesion
from app.errores import ErrorApi, no_autorizado, sin_permiso
from app.modelos import Sobandero, Usuario
from app.servicios.auth import usuario_de_sesion

CABECERA_CSRF = "X-Sobanderia"
METODOS_SEGUROS = {"GET", "HEAD", "OPTIONS"}


def exige_csrf(request: Request) -> None:
    """Las rutas que cambian datos exigen una cabecera propia (defensa contra CSRF)."""
    if request.method not in METODOS_SEGUROS and request.headers.get(CABECERA_CSRF) != "1":
        raise sin_permiso("Solicitud no permitida.")


def token_de_cookie(request: Request) -> str | None:
    return request.cookies.get(ajustes.cookie_sesion)


def sesion_activa(
    _: Annotated[None, Depends(exige_csrf)],
    db: Annotated[Session, Depends(obtener_sesion)],
    token: Annotated[str | None, Depends(token_de_cookie)],
) -> Usuario:
    """Usuario con sesión válida, aunque tenga pendiente cambiar la clave."""
    usuario = usuario_de_sesion(db, token)
    if usuario is None:
        raise no_autorizado()
    return usuario


def usuario_actual(usuario: Annotated[Usuario, Depends(sesion_activa)]) -> Usuario:
    """Usuario con sesión válida y sin clave temporal pendiente."""
    if usuario.debe_cambiar_clave:
        raise ErrorApi(403, "debe_cambiar_clave", "Antes de continuar debe cambiar su clave.")
    return usuario


def requiere_sobandero(usuario: Annotated[Usuario, Depends(usuario_actual)]) -> Usuario:
    """Sobandero o administrador (el área /panel admite a ambos)."""
    if usuario.rol not in ("sobandero", "admin"):
        raise sin_permiso()
    return usuario


def requiere_admin(usuario: Annotated[Usuario, Depends(usuario_actual)]) -> Usuario:
    if usuario.rol != "admin":
        raise sin_permiso()
    return usuario


def sobandero_actual(
    usuario: Annotated[Usuario, Depends(requiere_sobandero)],
    db: Annotated[Session, Depends(obtener_sesion)],
) -> Sobandero:
    """Perfil de atención de quien ingresó. Un administrador sin perfil no atiende citas."""
    perfil = db.scalar(select(Sobandero).where(Sobandero.usuario_id == usuario.id))
    if perfil is None:
        raise sin_permiso()
    return perfil

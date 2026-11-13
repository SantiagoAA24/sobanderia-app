"""Nombre y correo de quien ingresa. El correo pide la clave actual."""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.correo import EnviadorCorreo, enmascarar_correo
from app.errores import ErrorApi, clave_incorrecta
from app.modelos import Usuario
from app.seguridad.claves import verificar_clave

registro = logging.getLogger("sobanderia.perfil")


def _correo_en_uso() -> ErrorApi:
    return ErrorApi(409, "correo_en_uso", "Ese correo ya está en uso. Escriba otro.")


def actualizar(
    db: Session,
    enviador: EnviadorCorreo,
    usuario: Usuario,
    nombre: str | None,
    correo: str | None,
    clave_actual: str | None,
) -> Usuario:
    cambia_correo = correo is not None and correo != usuario.correo
    if cambia_correo:
        if not clave_actual:
            raise ErrorApi(422, "validacion", "Escriba su clave actual para cambiar el correo.")
        if not verificar_clave(usuario.clave_hash, clave_actual):
            raise clave_incorrecta()
        if db.scalar(select(Usuario.id).where(Usuario.correo == correo, Usuario.id != usuario.id)):
            raise _correo_en_uso()
    anterior = usuario.correo
    if nombre is not None:
        usuario.nombre = nombre
    if cambia_correo:
        assert correo is not None
        usuario.correo = correo
    try:
        db.commit()
    except IntegrityError as error:  # otro usuario tomó el correo entre la consulta y el guardado
        db.rollback()
        raise _correo_en_uso() from error
    if cambia_correo:
        registro.info("correo cambiado usuario=%s", usuario.id)
        enviador.enviar(
            anterior,
            "Su correo cambió",
            "El correo de su cuenta en Sobandería acaba de cambiar. "
            f"El nuevo es {enmascarar_correo(usuario.correo)}. "
            "Si no fue usted, avise al administrador.",
        )
    return usuario

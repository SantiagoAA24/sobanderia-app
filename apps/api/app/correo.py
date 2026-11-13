"""Envío de correo detrás de una interfaz. Por ahora solo hay una implementación falsa."""

import logging
from functools import lru_cache
from typing import Protocol

registro = logging.getLogger("sobanderia.correo")


class EnviadorCorreo(Protocol):
    def enviar(self, destino: str, asunto: str, cuerpo: str) -> None: ...


def enmascarar_correo(correo: str) -> str:
    usuario, _, dominio = correo.partition("@")
    return f"{usuario[:1]}***@{dominio}"


class CorreoFalso:
    """Escribe el mensaje (con el enlace) en el registro en vez de enviarlo."""

    def enviar(self, destino: str, asunto: str, cuerpo: str) -> None:
        registro.info("Correo a %s | %s | %s", enmascarar_correo(destino), asunto, cuerpo)


@lru_cache
def obtener_enviador() -> EnviadorCorreo:
    return CorreoFalso()

"""Proveedor para desarrollo y pruebas: escribe en el registro y no sale a internet."""

import itertools
import logging

from app.seguridad.celular import enmascarar
from app.whatsapp.proveedor import Mensaje

registro = logging.getLogger("whatsapp.falso")


class Falso:
    def __init__(self) -> None:
        self._contador = itertools.count(1)
        # Para que las pruebas revisen lo que «salió».
        self.enviados: list[Mensaje] = []
        self.textos: list[tuple[str, str]] = []

    def enviar_plantilla(self, mensaje: Mensaje) -> str:
        self.enviados.append(mensaje)
        registro.info(
            "whatsapp falso plantilla=%s para=%s variables=%s enlace=%s",
            mensaje.plantilla,
            enmascarar(mensaje.celular),
            list(mensaje.parametros),
            "si" if mensaje.codigo_enlace else "no",
        )
        return f"falso-{next(self._contador)}"

    def enviar_texto(self, celular: str, texto: str) -> str:
        # El texto puede llevar un enlace de gestión: al registro solo va su largo.
        self.textos.append((celular, texto))
        registro.info("whatsapp falso texto para=%s caracteres=%d", enmascarar(celular), len(texto))
        return f"falso-{next(self._contador)}"

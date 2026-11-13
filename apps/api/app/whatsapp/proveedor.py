"""Interfaz que el worker conoce. Nada fuera de `app/whatsapp` sabe cómo habla Meta."""

from dataclasses import dataclass
from typing import Protocol


class ErrorEnvio(Exception):
    """El mensaje no salió. Nunca lleva el celular completo ni el código del enlace."""


class ErrorTemporal(ErrorEnvio):
    """Red, límite de Meta o falla del servidor: vale la pena reintentar."""


class ErrorPermanente(ErrorEnvio):
    """Meta lo rechazó o el mensaje está mal armado: reintentar no cambia nada."""


@dataclass(frozen=True)
class Mensaje:
    celular: str  # E.164
    plantilla: str
    parametros: tuple[str, ...]  # variables del cuerpo, en el orden de la plantilla
    codigo_enlace: str | None = None  # parte variable de la URL del botón de enlace
    payloads: tuple[str, ...] = ()  # un valor por botón de respuesta rápida


class ProveedorWhatsApp(Protocol):
    def enviar_plantilla(self, mensaje: Mensaje) -> str:
        """Devuelve el id que le da el proveedor al mensaje."""
        ...

    def enviar_texto(self, celular: str, texto: str) -> str:
        """Texto libre: solo vale dentro de la ventana de 24 horas del cliente."""
        ...

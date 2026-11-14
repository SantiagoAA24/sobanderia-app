"""Envío de correo detrás de una interfaz. Por ahora solo hay una implementación falsa."""

import logging
import smtplib
import ssl
from email.message import EmailMessage
from functools import lru_cache
from typing import Protocol

from app.config import SOLO_DESARROLLO, ajustes

registro = logging.getLogger("sobanderia.correo")


class EnviadorCorreo(Protocol):
    def enviar(self, destino: str, asunto: str, cuerpo: str) -> None: ...


def enmascarar_correo(correo: str) -> str:
    usuario, _, dominio = correo.partition("@")
    return f"{usuario[:1]}***@{dominio}"


class CorreoFalso:
    """No envía nada. En desarrollo y pruebas escribe el mensaje (con su enlace) en el registro
    para poder abrirlo; en cualquier otro entorno solo deja el destino enmascarado y el asunto:
    el enlace de recuperación nunca debe quedar en un registro de producción (H-01)."""

    def enviar(self, destino: str, asunto: str, cuerpo: str) -> None:
        if ajustes.entorno in SOLO_DESARROLLO:
            registro.info("Correo a %s | %s | %s", enmascarar_correo(destino), asunto, cuerpo)
        else:
            registro.info("Correo a %s | %s | (cuerpo omitido)", enmascarar_correo(destino), asunto)


class CorreoSmtp:
    """Envía por SMTP (cualquier proveedor). Un fallo no se propaga: si la solicitud de recuperación
    fallara solo para las cuentas que existen, la respuesta delataría cuáles son. Se registra el
    tipo de error (nunca el cuerpo) para que quien opera lo vea."""

    def enviar(self, destino: str, asunto: str, cuerpo: str) -> None:
        mensaje = EmailMessage()
        mensaje["From"] = ajustes.correo_desde
        mensaje["To"] = destino
        mensaje["Subject"] = asunto
        mensaje.set_content(cuerpo)
        try:
            with smtplib.SMTP(ajustes.smtp_host, ajustes.smtp_puerto, timeout=15) as servidor:
                if ajustes.smtp_starttls:
                    servidor.starttls(context=ssl.create_default_context())
                if ajustes.smtp_usuario:
                    servidor.login(ajustes.smtp_usuario, ajustes.smtp_clave)
                servidor.send_message(mensaje)
        except (smtplib.SMTPException, OSError) as error:
            registro.warning(
                "Correo a %s no salió: %s", enmascarar_correo(destino), type(error).__name__
            )
            return
        registro.info("Correo a %s enviado | %s", enmascarar_correo(destino), asunto)


@lru_cache
def obtener_enviador() -> EnviadorCorreo:
    return CorreoSmtp() if ajustes.correo_proveedor == "smtp" else CorreoFalso()

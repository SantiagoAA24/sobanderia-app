"""WhatsApp Cloud API de Meta, con plantillas aprobadas."""

from typing import Any

import httpx

from app.whatsapp.proveedor import ErrorPermanente, ErrorTemporal, Mensaje

RAIZ = "https://graph.facebook.com"


class CloudApi:
    def __init__(
        self,
        token: str,
        phone_number_id: str,
        version: str = "v21.0",
        idioma: str = "es",
        transporte: httpx.BaseTransport | None = None,
    ) -> None:
        self._url = f"{RAIZ}/{version}/{phone_number_id}/messages"
        self._idioma = idioma
        self._cliente = httpx.Client(
            headers={"Authorization": f"Bearer {token}"},
            timeout=httpx.Timeout(10.0),
            transport=transporte,
        )

    def enviar_plantilla(self, mensaje: Mensaje) -> str:
        componentes: list[dict[str, Any]] = [
            {
                "type": "body",
                "parameters": [{"type": "text", "text": valor} for valor in mensaje.parametros],
            }
        ]
        if mensaje.codigo_enlace is not None:
            componentes.append(
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": mensaje.codigo_enlace}],
                }
            )
        for indice, payload in enumerate(mensaje.payloads):
            componentes.append(
                {
                    "type": "button",
                    "sub_type": "quick_reply",
                    "index": str(indice),
                    "parameters": [{"type": "payload", "payload": payload}],
                }
            )
        return self._enviar(
            {
                "messaging_product": "whatsapp",
                "to": _sin_mas(mensaje.celular),
                "type": "template",
                "template": {
                    "name": mensaje.plantilla,
                    "language": {"code": self._idioma},
                    "components": componentes,
                },
            }
        )

    def enviar_texto(self, celular: str, texto: str) -> str:
        return self._enviar(
            {
                "messaging_product": "whatsapp",
                "to": _sin_mas(celular),
                "type": "text",
                "text": {"body": texto},
            }
        )

    def _enviar(self, cuerpo: dict[str, Any]) -> str:
        try:
            respuesta = self._cliente.post(self._url, json=cuerpo)
        except httpx.HTTPError as error:
            # Solo el tipo de error: el texto de la excepción puede traer la URL o el cuerpo.
            raise ErrorTemporal(f"red: {type(error).__name__}") from None
        if respuesta.status_code == 429 or respuesta.status_code >= 500:
            raise ErrorTemporal(f"Meta respondió {respuesta.status_code}")
        if respuesta.status_code >= 400:
            raise ErrorPermanente(_describir(respuesta))
        try:
            return str(respuesta.json()["messages"][0]["id"])
        except (ValueError, KeyError, IndexError, TypeError):
            raise ErrorTemporal("respuesta de Meta sin id de mensaje") from None


def _sin_mas(celular: str) -> str:
    return celular.removeprefix("+")


def _describir(respuesta: httpx.Response) -> str:
    """Código de Meta y estado HTTP; el mensaje de Meta puede repetir el celular, no se guarda."""
    try:
        codigo = respuesta.json()["error"]["code"]
    except (ValueError, KeyError, TypeError):
        codigo = "?"
    return f"Meta rechazó el mensaje (http {respuesta.status_code}, código {codigo})"

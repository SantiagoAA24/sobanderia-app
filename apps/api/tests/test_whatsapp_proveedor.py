"""Proveedores de WhatsApp: el falso no filtra celulares y Cloud API traduce bien a Meta."""

import json
import logging
from typing import Any

import httpx
import pytest

from app.config import Ajustes
from app.whatsapp import (
    CloudApi,
    ErrorPermanente,
    ErrorTemporal,
    Falso,
    Mensaje,
    crear_proveedor,
)
from app.whatsapp.plantillas import PLANTILLAS, armar_mensaje

VARIABLES = {"nombre": "Ana", "sobandero": "Luis", "dia": "lunes 7 de enero", "hora": "10:00 a. m."}
CELULAR = "+573001234567"


def test_hay_seis_plantillas() -> None:
    assert set(PLANTILLAS) == {
        "cita_confirmada",
        "recordatorio_cita",
        "cita_cambiada",
        "cita_cancelada",
        "cita_cancelada_sobandero",
        "enlace_cita",
    }


def test_armar_mensaje_ordena_variables_y_pone_el_codigo_del_enlace() -> None:
    mensaje = armar_mensaje("cita_confirmada", CELULAR, VARIABLES, token="abc", referencia=7)
    assert mensaje.parametros == ("Ana", "Luis", "lunes 7 de enero", "10:00 a. m.")
    assert mensaje.codigo_enlace == "abc"
    assert mensaje.payloads == ()


def test_cancelada_solo_lleva_las_variables_que_usa() -> None:
    mensaje = armar_mensaje("cita_cancelada", CELULAR, VARIABLES, token=None, referencia=7)
    assert mensaje.parametros == ("Ana", "lunes 7 de enero", "10:00 a. m.")
    assert mensaje.codigo_enlace is None


def test_recordatorio_lleva_dos_botones_de_respuesta_con_la_referencia() -> None:
    mensaje = armar_mensaje("recordatorio_cita", CELULAR, VARIABLES, token=None, referencia=7)
    assert mensaje.payloads == ("asistire:7", "cambiar:7")


def test_plantilla_con_enlace_sin_codigo_es_error_permanente() -> None:
    with pytest.raises(ErrorPermanente):
        armar_mensaje("cita_cambiada", CELULAR, VARIABLES, token=None, referencia=7)


def test_plantilla_desconocida_es_error_permanente() -> None:
    with pytest.raises(ErrorPermanente):
        armar_mensaje("no_existe", CELULAR, VARIABLES, token=None, referencia=7)


def test_variable_faltante_es_error_permanente() -> None:
    with pytest.raises(ErrorPermanente):
        armar_mensaje("cita_cancelada", CELULAR, {"nombre": "Ana"}, token=None, referencia=7)


def test_falso_escribe_en_el_registro_sin_el_celular_completo(
    caplog: pytest.LogCaptureFixture,
) -> None:
    mensaje = armar_mensaje("cita_confirmada", CELULAR, VARIABLES, token="secreto", referencia=1)
    with caplog.at_level(logging.INFO):
        id_externo = Falso().enviar_plantilla(mensaje)
    assert id_externo.startswith("falso-")
    texto = caplog.text
    assert "cita_confirmada" in texto
    assert "300 *** 4567" in texto
    assert "3001234567" not in texto
    assert "secreto" not in texto


def test_falso_envia_texto_libre(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO):
        id_externo = Falso().enviar_texto(CELULAR, "Gracias, Ana.")
    assert id_externo.startswith("falso-")
    assert "3001234567" not in caplog.text


def test_fabrica_elige_el_proveedor() -> None:
    assert isinstance(crear_proveedor(Ajustes(proveedor_whatsapp="falso")), Falso)
    nube = crear_proveedor(
        Ajustes(proveedor_whatsapp="cloudapi", whatsapp_token="t", whatsapp_phone_number_id="123")
    )
    assert isinstance(nube, CloudApi)


def test_fabrica_rechaza_cloudapi_sin_credenciales_y_nombres_raros() -> None:
    with pytest.raises(ValueError):
        crear_proveedor(Ajustes(proveedor_whatsapp="cloudapi"))
    with pytest.raises(ValueError):
        crear_proveedor(Ajustes(proveedor_whatsapp="otro"))


# --- Cloud API con transporte simulado ---------------------------------------------------


def _nube(respuesta: httpx.Response | Exception, capturas: list[httpx.Request]) -> CloudApi:
    def manejar(peticion: httpx.Request) -> httpx.Response:
        capturas.append(peticion)
        if isinstance(respuesta, Exception):
            raise respuesta
        return respuesta

    return CloudApi(
        token="TOKEN",
        phone_number_id="999",
        version="v21.0",
        idioma="es",
        transporte=httpx.MockTransport(manejar),
    )


def _ok() -> httpx.Response:
    return httpx.Response(200, json={"messages": [{"id": "wamid.ABC"}]})


def _cuerpo(peticion: httpx.Request) -> dict[str, Any]:
    cuerpo: dict[str, Any] = json.loads(peticion.content)
    return cuerpo


def test_cloudapi_envia_plantilla_con_cuerpo_y_boton_de_enlace() -> None:
    capturas: list[httpx.Request] = []
    mensaje = armar_mensaje("cita_confirmada", CELULAR, VARIABLES, token="abc", referencia=1)
    assert _nube(_ok(), capturas).enviar_plantilla(mensaje) == "wamid.ABC"
    peticion = capturas[0]
    assert str(peticion.url) == "https://graph.facebook.com/v21.0/999/messages"
    assert peticion.headers["authorization"] == "Bearer TOKEN"
    cuerpo = _cuerpo(peticion)
    assert cuerpo["messaging_product"] == "whatsapp"
    assert cuerpo["to"] == "573001234567"  # Meta recibe el número sin «+»
    assert cuerpo["type"] == "template"
    assert cuerpo["template"] == {
        "name": "cita_confirmada",
        "language": {"code": "es"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": "Ana"},
                    {"type": "text", "text": "Luis"},
                    {"type": "text", "text": "lunes 7 de enero"},
                    {"type": "text", "text": "10:00 a. m."},
                ],
            },
            {
                "type": "button",
                "sub_type": "url",
                "index": "0",
                "parameters": [{"type": "text", "text": "abc"}],
            },
        ],
    }


def test_cloudapi_botones_de_respuesta_rapida() -> None:
    capturas: list[httpx.Request] = []
    mensaje = armar_mensaje("recordatorio_cita", CELULAR, VARIABLES, token=None, referencia=9)
    _nube(_ok(), capturas).enviar_plantilla(mensaje)
    componentes = _cuerpo(capturas[0])["template"]["components"]
    assert componentes[1:] == [
        {
            "type": "button",
            "sub_type": "quick_reply",
            "index": "0",
            "parameters": [{"type": "payload", "payload": "asistire:9"}],
        },
        {
            "type": "button",
            "sub_type": "quick_reply",
            "index": "1",
            "parameters": [{"type": "payload", "payload": "cambiar:9"}],
        },
    ]


def test_cloudapi_boton_fijo_no_lleva_componente_de_boton() -> None:
    capturas: list[httpx.Request] = []
    mensaje = armar_mensaje("cita_cancelada", CELULAR, VARIABLES, token=None, referencia=1)
    _nube(_ok(), capturas).enviar_plantilla(mensaje)
    componentes = _cuerpo(capturas[0])["template"]["components"]
    assert [c["type"] for c in componentes] == ["body"]


def test_cloudapi_texto_libre() -> None:
    capturas: list[httpx.Request] = []
    assert _nube(_ok(), capturas).enviar_texto(CELULAR, "Gracias, Ana.") == "wamid.ABC"
    cuerpo = _cuerpo(capturas[0])
    assert cuerpo["type"] == "text"
    assert cuerpo["text"] == {"body": "Gracias, Ana."}


@pytest.mark.parametrize("codigo", [429, 500, 502, 503])
def test_cloudapi_errores_de_servidor_son_temporales(codigo: int) -> None:
    mensaje = armar_mensaje("cita_cancelada", CELULAR, VARIABLES, token=None, referencia=1)
    nube = _nube(httpx.Response(codigo, json={"error": {"message": "falla"}}), [])
    with pytest.raises(ErrorTemporal):
        nube.enviar_plantilla(mensaje)


def test_cloudapi_error_de_red_es_temporal() -> None:
    mensaje = armar_mensaje("cita_cancelada", CELULAR, VARIABLES, token=None, referencia=1)
    nube = _nube(httpx.ConnectTimeout("sin respuesta"), [])
    with pytest.raises(ErrorTemporal):
        nube.enviar_plantilla(mensaje)


@pytest.mark.parametrize("codigo", [400, 401, 403, 404])
def test_cloudapi_errores_del_cliente_son_permanentes_y_no_filtran_el_celular(codigo: int) -> None:
    mensaje = armar_mensaje("cita_cancelada", CELULAR, VARIABLES, token=None, referencia=1)
    respuesta = httpx.Response(
        codigo, json={"error": {"code": 131026, "message": "No entregable a 573001234567"}}
    )
    with pytest.raises(ErrorPermanente) as error:
        _nube(respuesta, []).enviar_plantilla(mensaje)
    assert "573001234567" not in str(error.value)
    assert "131026" in str(error.value)


def test_mensaje_es_inmutable() -> None:
    mensaje = Mensaje(celular=CELULAR, plantilla="x", parametros=(), payloads=())
    with pytest.raises(AttributeError):
        mensaje.plantilla = "y"  # type: ignore[misc]

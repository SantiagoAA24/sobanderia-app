"""Webhook de Meta: verificación, firma, estados de entrega y respuestas rápidas."""

import hashlib
import hmac
import json
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import Cita, EnlaceCita, Notificacion
from app.seguridad.tokens import hash_token
from app.whatsapp import Falso, obtener_proveedor
from tests.conftest import AHORA_PRUEBA, crear_cita, crear_cliente, crear_sobandero

SECRETO = "secreto-de-app"
VERIFICACION = "verificacion-123"
RUTA = "/webhooks/whatsapp"


@pytest.fixture(autouse=True)
def credenciales(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ajustes, "whatsapp_app_secret", SECRETO)
    monkeypatch.setattr(ajustes, "whatsapp_verify_token", VERIFICACION)


@pytest.fixture
def proveedor(api: TestClient) -> Iterator[Falso]:
    from app.main import app

    falso = Falso()
    app.dependency_overrides[obtener_proveedor] = lambda: falso
    yield falso


def _firma(cuerpo: bytes, secreto: str = SECRETO) -> str:
    return "sha256=" + hmac.new(secreto.encode(), cuerpo, hashlib.sha256).hexdigest()


def _enviar(api: TestClient, datos: dict[str, Any], firma: str | None = "buena") -> Any:
    cuerpo = json.dumps(datos).encode()
    cabeceras = {"Content-Type": "application/json"}
    if firma == "buena":
        cabeceras["X-Hub-Signature-256"] = _firma(cuerpo)
    elif firma is not None:
        cabeceras["X-Hub-Signature-256"] = firma
    return api.post(RUTA, content=cuerpo, headers=cabeceras)


def _evento(
    estados: list[dict[str, Any]] | None = None, mensajes: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    valor: dict[str, Any] = {"messaging_product": "whatsapp"}
    if estados:
        valor["statuses"] = estados
    if mensajes:
        valor["messages"] = mensajes
    return {"object": "whatsapp_business_account", "entry": [{"changes": [{"value": valor}]}]}


def _enviada(sesion: Session, cita: Cita, id_externo: str = "wamid.1") -> Notificacion:
    fila = Notificacion(
        cita_id=cita.id,
        tipo="recordatorio",
        plantilla="recordatorio_cita",
        variables={"nombre": "Cliente 1", "sobandero": "Sobandero 1"},
        enviar_en=AHORA_PRUEBA,
        estado="enviada",
        id_externo=id_externo,
        enviada_en=AHORA_PRUEBA,
    )
    sesion.add(fila)
    sesion.flush()
    return fila


@pytest.fixture
def cita(sesion: Session) -> Cita:
    cita = crear_cita(sesion, crear_sobandero(sesion, 1), crear_cliente(sesion))
    sesion.add(EnlaceCita(cita_id=cita.id, token_hash=hash_token("viejo"), vence_en=cita.inicio))
    sesion.flush()
    return cita


# --- Verificación y firma ---------------------------------------------------------------


def test_verificacion_devuelve_el_reto(api: TestClient) -> None:
    respuesta = api.get(
        RUTA,
        params={"hub.mode": "subscribe", "hub.verify_token": VERIFICACION, "hub.challenge": "777"},
    )
    assert respuesta.status_code == 200
    assert respuesta.text == "777"


@pytest.mark.parametrize("token", ["otro", ""])
def test_verificacion_con_token_malo_da_403(api: TestClient, token: str) -> None:
    respuesta = api.get(
        RUTA, params={"hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": "777"}
    )
    assert respuesta.status_code == 403


def test_verificacion_sin_token_configurado_da_403(
    api: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ajustes, "whatsapp_verify_token", "")
    respuesta = api.get(
        RUTA, params={"hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "777"}
    )
    assert respuesta.status_code == 403


@pytest.mark.parametrize("firma", [None, "sha256=malafirma", "sha256=" + "0" * 64, "sin-prefijo"])
def test_firma_mala_o_ausente_da_403_y_no_toca_nada(
    api: TestClient, sesion: Session, cita: Cita, firma: str | None
) -> None:
    fila = _enviada(sesion, cita)
    evento = _evento([{"id": "wamid.1", "status": "delivered", "timestamp": "1893456000"}])
    assert _enviar(api, evento, firma).status_code == 403
    sesion.refresh(fila)
    assert fila.entregada_en is None


def test_firma_hecha_con_otro_secreto_da_403(api: TestClient) -> None:
    cuerpo = json.dumps(_evento()).encode()
    respuesta = api.post(
        RUTA, content=cuerpo, headers={"X-Hub-Signature-256": _firma(cuerpo, "otro-secreto")}
    )
    assert respuesta.status_code == 403


def test_sin_secreto_configurado_nunca_acepta(
    api: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ajustes, "whatsapp_app_secret", "")
    cuerpo = b"{}"
    respuesta = api.post(RUTA, content=cuerpo, headers={"X-Hub-Signature-256": _firma(cuerpo, "")})
    assert respuesta.status_code == 403


# --- Estados de entrega -----------------------------------------------------------------


def test_delivered_y_read_guardan_el_momento(api: TestClient, sesion: Session, cita: Cita) -> None:
    fila = _enviada(sesion, cita)
    entregada = int(datetime(2030, 1, 1, 15, 1, tzinfo=UTC).timestamp())
    leida = int(datetime(2030, 1, 1, 15, 5, tzinfo=UTC).timestamp())
    assert (
        _enviar(
            api, _evento([{"id": "wamid.1", "status": "delivered", "timestamp": str(entregada)}])
        ).status_code
        == 200
    )
    sesion.refresh(fila)
    assert fila.entregada_en == datetime(2030, 1, 1, 15, 1, tzinfo=UTC)
    assert fila.leida_en is None
    _enviar(api, _evento([{"id": "wamid.1", "status": "read", "timestamp": str(leida)}]))
    sesion.refresh(fila)
    assert fila.leida_en == datetime(2030, 1, 1, 15, 5, tzinfo=UTC)
    assert fila.estado == "enviada"


def test_read_sin_delivered_tambien_marca_entregada(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    fila = _enviada(sesion, cita)
    marca = int(datetime(2030, 1, 1, 15, 5, tzinfo=UTC).timestamp())
    _enviar(api, _evento([{"id": "wamid.1", "status": "read", "timestamp": str(marca)}]))
    sesion.refresh(fila)
    assert fila.entregada_en == fila.leida_en


def test_failed_deja_la_notificacion_fallida_con_el_codigo(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    fila = _enviada(sesion, cita)
    estado = {
        "id": "wamid.1",
        "status": "failed",
        "timestamp": "1893456000",
        "errors": [{"code": 131026, "title": "No entregable a 573001234567"}],
    }
    assert _enviar(api, _evento([estado])).status_code == 200
    sesion.refresh(fila)
    assert fila.estado == "fallida"
    assert "131026" in (fila.ultimo_error or "")
    assert "573001234567" not in (fila.ultimo_error or "")


def test_un_estado_atrasado_no_deshace_la_lectura(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    fila = _enviada(sesion, cita)
    _enviar(api, _evento([{"id": "wamid.1", "status": "read", "timestamp": "1893456300"}]))
    _enviar(api, _evento([{"id": "wamid.1", "status": "delivered", "timestamp": "1893456600"}]))
    sesion.refresh(fila)
    assert fila.leida_en is not None
    assert fila.entregada_en == fila.leida_en  # no se pisa con el «delivered» que llegó tarde


def test_estado_de_mensaje_desconocido_responde_200(api: TestClient) -> None:
    evento = _evento([{"id": "wamid.nada", "status": "delivered", "timestamp": "1893456000"}])
    assert _enviar(api, evento).status_code == 200


def test_cuerpo_que_no_es_json_responde_200_sin_romper(api: TestClient) -> None:
    cuerpo = b"esto no es json"
    respuesta = api.post(RUTA, content=cuerpo, headers={"X-Hub-Signature-256": _firma(cuerpo)})
    assert respuesta.status_code == 200


# --- Respuestas rápidas -----------------------------------------------------------------


def _boton(payload: str, de: str = "573000000001") -> dict[str, Any]:
    return {
        "from": de,
        "id": "wamid.entrante",
        "type": "button",
        "button": {"payload": payload, "text": "texto"},
    }


def test_si_asistire_agradece_en_la_ventana_de_24_horas(
    api: TestClient, sesion: Session, cita: Cita, proveedor: Falso
) -> None:
    fila = _enviada(sesion, cita)
    assert _enviar(api, _evento(mensajes=[_boton(f"asistire:{fila.id}")])).status_code == 200
    assert proveedor.textos == [("+573000000001", "Gracias, Cliente 1. Lo esperamos.")]


def test_necesito_cambiarla_responde_con_un_enlace_nuevo(
    api: TestClient, sesion: Session, cita: Cita, proveedor: Falso
) -> None:
    fila = _enviada(sesion, cita)
    _enviar(api, _evento(mensajes=[_boton(f"cambiar:{fila.id}")]))
    (destino, texto), *resto = proveedor.textos
    assert destino == "+573000000001" and not resto
    assert texto.startswith("Con gusto. Elija otro día u hora aquí: ")
    token = texto.rsplit("/mi-cita/", 1)[1]
    enlace = sesion.scalars(select(EnlaceCita)).one()
    assert enlace.token_hash == hash_token(token)  # el enlace del mensaje es el vigente
    assert api.get(f"/mi-cita/{token}").status_code == 200


def test_otro_texto_responde_con_el_enlace_para_gestionar(
    api: TestClient, sesion: Session, cita: Cita, proveedor: Falso
) -> None:
    mensaje = {"from": "573000000001", "id": "wamid.2", "type": "text", "text": {"body": "hola"}}
    _enviar(api, _evento(mensajes=[mensaje]))
    (_, texto), *resto = proveedor.textos
    assert not resto
    assert texto.startswith(
        "Gracias por escribirnos. Para cambiar o cancelar su cita, entre aquí: "
    )
    assert texto.endswith(". Si prefiere, llámenos.")
    assert "/mi-cita/" in texto


def test_otro_texto_de_quien_no_tiene_cita_no_recibe_enlace(
    api: TestClient, sesion: Session, proveedor: Falso
) -> None:
    crear_cliente(sesion, 5)
    mensaje = {"from": "573000000005", "id": "wamid.3", "type": "text", "text": {"body": "hola"}}
    _enviar(api, _evento(mensajes=[mensaje]))
    (_, texto), *resto = proveedor.textos
    assert not resto and "/mi-cita/" not in texto
    assert texto.startswith("Gracias por escribirnos.")


def test_un_boton_de_otro_celular_se_ignora(
    api: TestClient, sesion: Session, cita: Cita, proveedor: Falso
) -> None:
    fila = _enviada(sesion, cita)
    _enviar(api, _evento(mensajes=[_boton(f"cambiar:{fila.id}", de="573009999999")]))
    assert proveedor.textos == []
    assert sesion.scalars(select(EnlaceCita)).one().token_hash == hash_token("viejo")


def test_boton_con_payload_raro_se_ignora(
    api: TestClient, sesion: Session, cita: Cita, proveedor: Falso
) -> None:
    for payload in ("basura", "asistire:abc", "asistire:99999", "borrar:1"):
        assert _enviar(api, _evento(mensajes=[_boton(payload)])).status_code == 200
    assert proveedor.textos == []


def test_boton_de_una_cita_ya_cancelada_no_entrega_enlace(
    api: TestClient, sesion: Session, cita: Cita, proveedor: Falso
) -> None:
    fila = _enviada(sesion, cita)
    cita.estado = "cancelada"
    sesion.flush()
    _enviar(api, _evento(mensajes=[_boton(f"cambiar:{fila.id}")]))
    (_, texto), *resto = proveedor.textos
    assert not resto and "/mi-cita/" not in texto


def test_si_el_envio_de_la_respuesta_falla_el_webhook_igual_responde_200(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    from app.main import app
    from app.whatsapp import ErrorTemporal

    class Caido(Falso):
        def enviar_texto(self, celular: str, texto: str) -> str:
            raise ErrorTemporal("Meta respondió 503")

    app.dependency_overrides[obtener_proveedor] = lambda: Caido()
    fila = _enviada(sesion, cita)
    assert _enviar(api, _evento(mensajes=[_boton(f"asistire:{fila.id}")])).status_code == 200


def test_la_ruta_no_exige_la_cabecera_csrf(api: TestClient) -> None:
    """Meta no manda `X-Sobanderia`: la firma es la defensa de esta ruta."""
    assert _enviar(api, _evento()).status_code == 200

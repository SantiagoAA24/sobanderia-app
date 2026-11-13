"""Rutas públicas de la Fase 5: negocio, próximo cupo y «Encontrar mi cita»."""

import logging
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import EnlaceCita, Negocio, Notificacion
from app.seguridad.tokens import hash_token
from tests.conftest import (
    AHORA_PRUEBA,
    CSRF,
    INICIO,
    crear_cita,
    crear_cliente,
    sobandero_con_horario,
)
from tests.test_publico_citas import datos


def test_negocio_devuelve_lo_que_muestra_inicio(api: TestClient, sesion: Session) -> None:
    sesion.merge(
        Negocio(
            id=1,
            nombre="Sobandería",
            direccion="Calle 1 # 2-3",
            telefono="+573001112233",
            mensaje_bienvenida="Bienvenido.",
        )
    )
    sesion.flush()
    respuesta = api.get("/publico/negocio")
    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "nombre": "Sobandería",
        "direccion": "Calle 1 # 2-3",
        "telefono": "+573001112233",
        "mensaje_bienvenida": "Bienvenido.",
    }


def test_proximo_cupo_es_la_primera_hora_libre(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    cuerpo = api.get("/publico/sobanderos").json()
    # AHORA_PRUEBA es martes 10:00 en Bogotá; con antelación, la primera hora es posterior.
    cupo = datetime.fromisoformat(cuerpo[0]["proximo_cupo"])
    assert cuerpo[0]["id"] == sobandero.id
    assert cupo > AHORA_PRUEBA
    assert cupo.astimezone(UTC).date() == AHORA_PRUEBA.date()


def test_proximo_cupo_salta_las_horas_ocupadas(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    primero = datetime.fromisoformat(api.get("/publico/sobanderos").json()[0]["proximo_cupo"])
    crear_cita(sesion, sobandero, crear_cliente(sesion), primero)
    segundo = datetime.fromisoformat(api.get("/publico/sobanderos").json()[0]["proximo_cupo"])
    assert segundo == primero + timedelta(minutes=30)


def test_proximo_cupo_es_nulo_sin_horario(api: TestClient, sesion: Session) -> None:
    from tests.conftest import crear_sobandero

    crear_sobandero(sesion, 1)
    assert api.get("/publico/sobanderos").json()[0]["proximo_cupo"] is None


# --- Encontrar mi cita -------------------------------------------------------------------


def _agendar(api: TestClient, sesion: Session) -> str:
    sobandero = sobandero_con_horario(sesion)
    return api.post("/publico/citas", json=datos(sobandero.id), headers=CSRF).json()["token"]


def _pedir(api: TestClient, celular: str = "300 123 4567"):  # noqa: ANN202
    return api.post("/publico/mi-cita/enlace", json={"celular": celular}, headers=CSRF)


def test_enlace_encola_un_mensaje_con_token_nuevo(api: TestClient, sesion: Session) -> None:
    token_viejo = _agendar(api, sesion)
    antes = len(sesion.scalars(select(Notificacion)).all())
    respuesta = _pedir(api)
    assert respuesta.status_code == 202
    nuevas = sesion.scalars(select(Notificacion).order_by(Notificacion.id)).all()[antes:]
    assert len(nuevas) == 1
    assert nuevas[0].plantilla == "cita_confirmada"
    token_nuevo = nuevas[0].variables["token"]
    # El enlace nuevo funciona y reemplaza al anterior (un solo enlace por cita).
    assert api.get(f"/mi-cita/{token_nuevo}").status_code == 200
    assert api.get(f"/mi-cita/{token_viejo}").status_code == 410
    fila = sesion.scalars(select(EnlaceCita)).one()
    assert fila.token_hash == hash_token(token_nuevo)


def test_responde_igual_si_el_celular_no_tiene_cita(api: TestClient, sesion: Session) -> None:
    _agendar(api, sesion)
    antes = len(sesion.scalars(select(Notificacion)).all())
    respuesta = _pedir(api, "301 999 9999")
    assert respuesta.status_code == 202
    assert respuesta.json() == _pedir(api).json()
    assert len(sesion.scalars(select(Notificacion)).all()) == antes + 1  # solo el que sí existe


def test_no_manda_enlace_de_citas_canceladas_ni_pasadas(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    cliente = crear_cliente(sesion)
    crear_cita(sesion, sobandero, cliente, INICIO, estado="cancelada")
    crear_cita(sesion, sobandero, cliente, AHORA_PRUEBA - timedelta(days=2))
    assert _pedir(api, cliente.celular).status_code == 202
    assert sesion.scalars(select(Notificacion)).all() == []


def test_celular_invalido_da_422(api: TestClient) -> None:
    assert _pedir(api, "123").status_code == 422


def test_limita_los_intentos_por_celular(api: TestClient, sesion: Session) -> None:
    _agendar(api, sesion)
    limite = ajustes.intentos_max_correo
    codigos = [_pedir(api).status_code for _ in range(limite + 2)]
    assert codigos[:limite] == [202] * limite
    assert codigos[limite:] == [429, 429]
    assert "Retry-After" in _pedir(api).headers
    # Otro celular no se ve afectado por el límite del primero.
    assert _pedir(api, "301 999 9999").status_code == 202


def test_pide_la_cabecera_csrf(api: TestClient) -> None:
    respuesta = api.post("/publico/mi-cita/enlace", json={"celular": "300 123 4567"})
    assert respuesta.status_code in (400, 403)


def test_no_registra_el_celular_completo(
    api: TestClient, sesion: Session, caplog: pytest.LogCaptureFixture
) -> None:
    _agendar(api, sesion)
    with caplog.at_level(logging.DEBUG):
        _pedir(api)
    assert "3001234567" not in caplog.text

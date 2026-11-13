"""Rutas públicas: sobanderos, días, horas y crear cita sin cuenta."""

import logging
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modelos import Cita, Cliente, EnlaceCita, Notificacion
from app.seguridad.tokens import hash_token
from tests.conftest import (
    CSRF,
    INICIO,
    crear_cita,
    crear_cliente,
    sobandero_con_horario,
)


def datos(
    sobandero_id: int, inicio: datetime | str = INICIO, **cambios: object
) -> dict[str, object]:
    base: dict[str, object] = {
        "sobandero_id": sobandero_id,
        "inicio": inicio if isinstance(inicio, str) else inicio.isoformat(),
        "nombre": "María Pérez",
        "celular": "300 123 4567",
        "consentimiento": True,
    }
    return base | cambios


def test_lista_solo_sobanderos_que_reciben_citas(api: TestClient, sesion: Session) -> None:
    uno = sobandero_con_horario(sesion, 1)
    sobandero_con_horario(sesion, 2).recibe_citas = False
    inactivo = sobandero_con_horario(sesion, 3)
    inactivo.usuario.activo = False
    sesion.flush()
    respuesta = api.get("/publico/sobanderos")
    assert respuesta.status_code == 200
    assert [s["id"] for s in respuesta.json()] == [uno.id]
    assert respuesta.json()[0]["duracion_min"] == 30


def test_dias_con_horas(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    dias = api.get(f"/publico/sobanderos/{sobandero.id}/dias").json()["dias"]
    assert dias[0] == "2030-01-01"
    assert "2030-01-05" not in dias and "2030-01-06" not in dias  # fin de semana
    assert "2030-01-07" in dias
    assert dias[-1] <= "2030-01-30"


def test_horas_de_un_dia(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    crear_cita(sesion, sobandero, crear_cliente(sesion))
    cuerpo = api.get(
        f"/publico/sobanderos/{sobandero.id}/horas", params={"dia": "2030-01-07"}
    ).json()
    assert cuerpo["duracion_min"] == 30
    assert "2030-01-07T15:00:00Z" not in cuerpo["horas"]  # 10:00 ocupada
    assert "2030-01-07T13:00:00Z" in cuerpo["horas"]  # 8:00 libre


def test_horas_dia_invalido_da_422(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    respuesta = api.get(f"/publico/sobanderos/{sobandero.id}/horas", params={"dia": "ayer"})
    assert respuesta.status_code == 422
    assert respuesta.json()["codigo"] == "validacion"


def test_sobandero_inexistente_da_404(api: TestClient) -> None:
    respuesta = api.get("/publico/sobanderos/999999/dias")
    assert respuesta.status_code == 404
    assert respuesta.json()["codigo"] == "no_encontrado"


def test_crear_cita_guarda_cita_enlace_y_notificaciones(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    respuesta = api.post("/publico/citas", json=datos(sobandero.id), headers=CSRF)
    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["cita"]["estado"] == "agendada"
    assert cuerpo["cita"]["inicio"] == "2030-01-07T15:00:00Z"
    assert cuerpo["cita"]["puede_modificar"] is True

    cita = sesion.scalars(select(Cita)).one()
    cliente = sesion.scalars(select(Cliente)).one()
    assert cliente.celular == "+573001234567"
    assert cliente.politica_aceptada_en is not None and cliente.politica_version
    assert cita.origen == "cliente"
    # El token real no se guarda: solo su hash.
    enlace = sesion.scalars(select(EnlaceCita)).one()
    assert enlace.token_hash == hash_token(cuerpo["token"]) != cuerpo["token"]
    assert enlace.vence_en == cita.inicio.replace(hour=5, minute=0) + timedelta(days=2)

    notis = {n.tipo: n for n in sesion.scalars(select(Notificacion))}
    assert notis["confirmacion"].plantilla == "cita_confirmada"
    assert notis["confirmacion"].variables["token"] == cuerpo["token"]
    assert notis["confirmacion"].variables["dia"] == "lunes 7 de enero"
    assert notis["confirmacion"].variables["hora"] == "10:00 a. m."
    assert notis["recordatorio"].enviar_en == cita.inicio.replace(hour=23, minute=0) - timedelta(
        days=1
    )


def test_cliente_conocido_se_reutiliza_sin_pisar_el_nombre(
    api: TestClient, sesion: Session
) -> None:
    sobandero = sobandero_con_horario(sesion)
    api.post("/publico/citas", json=datos(sobandero.id), headers=CSRF)
    otra = datos(
        sobandero.id, INICIO + timedelta(hours=1), nombre="Otro Nombre", celular="+57 300-123-4567"
    )
    assert api.post("/publico/citas", json=otra, headers=CSRF).status_code == 201
    cliente = sesion.scalars(select(Cliente)).one()
    assert cliente.nombre == "María Pérez"
    assert sesion.scalar(select(func.count()).select_from(Cita)) == 2


@pytest.mark.parametrize("celular", ["123", "abc", "+0123456789", "2001234567", ""])
def test_celular_invalido_da_422(api: TestClient, sesion: Session, celular: str) -> None:
    sobandero = sobandero_con_horario(sesion)
    respuesta = api.post("/publico/citas", json=datos(sobandero.id, celular=celular), headers=CSRF)
    assert respuesta.status_code == 422
    assert respuesta.json()["codigo"] == "validacion"


def test_sin_consentimiento_da_422_y_no_crea_nada(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    respuesta = api.post(
        "/publico/citas", json=datos(sobandero.id, consentimiento=False), headers=CSRF
    )
    assert respuesta.status_code == 422
    assert sesion.scalar(select(func.count()).select_from(Cita)) == 0


def test_sin_encabezado_csrf_da_403(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    assert api.post("/publico/citas", json=datos(sobandero.id)).status_code == 403


def test_hora_ocupada_da_409_con_hasta_tres_alternativas(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    crear_cita(sesion, sobandero, crear_cliente(sesion))
    respuesta = api.post("/publico/citas", json=datos(sobandero.id), headers=CSRF)
    assert respuesta.status_code == 409
    cuerpo = respuesta.json()
    assert cuerpo["codigo"] == "hora_ocupada"
    alternativas = cuerpo["alternativas"]
    assert len(alternativas) == 3
    assert alternativas == sorted(alternativas)
    assert "2030-01-07T15:00:00Z" not in alternativas
    assert "2030-01-07T14:30:00Z" in alternativas and "2030-01-07T15:30:00Z" in alternativas
    # Las alternativas realmente se pueden reservar.
    assert (
        api.post(
            "/publico/citas", json=datos(sobandero.id, alternativas[0]), headers=CSRF
        ).status_code
        == 201
    )


def test_hora_ocupada_no_deja_cliente_ni_notificacion(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    crear_cita(sesion, sobandero, crear_cliente(sesion))
    api.post("/publico/citas", json=datos(sobandero.id), headers=CSRF)
    assert sesion.scalar(select(func.count()).select_from(Notificacion)) == 0
    assert sesion.scalar(select(func.count()).select_from(EnlaceCita)) == 0


def test_hora_fuera_de_horario_o_fuera_de_la_grilla_da_409(
    api: TestClient, sesion: Session
) -> None:
    sobandero = sobandero_con_horario(sesion)
    for inicio in (
        INICIO - timedelta(hours=5),
        INICIO + timedelta(minutes=10),
    ):  # 5:00 a. m. y 10:10
        respuesta = api.post("/publico/citas", json=datos(sobandero.id, inicio), headers=CSRF)
        assert respuesta.status_code == 409, inicio
        assert respuesta.json()["codigo"] == "hora_ocupada"


def test_hora_pasada_o_sin_antelacion_da_409(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    ahora_mas_30 = INICIO.replace(day=1) + timedelta(
        minutes=30
    )  # 2030-01-01 10:30 Bogotá, pasa 30 min
    respuesta = api.post("/publico/citas", json=datos(sobandero.id, ahora_mas_30), headers=CSRF)
    assert respuesta.status_code == 409


def test_el_celular_completo_no_aparece_en_los_registros(
    api: TestClient, sesion: Session, caplog: pytest.LogCaptureFixture
) -> None:
    sobandero = sobandero_con_horario(sesion)
    with caplog.at_level(logging.DEBUG):
        api.post("/publico/citas", json=datos(sobandero.id), headers=CSRF)
    texto = caplog.text
    assert "300 *** 4567" in texto
    assert "3001234567" not in texto and "300 123 4567" not in texto

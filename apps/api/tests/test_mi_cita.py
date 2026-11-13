"""Rutas con enlace firmado: ver, reprogramar y cancelar."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modelos import Cita, EnlaceCita, Notificacion, Sobandero
from app.seguridad.tokens import hash_token
from tests.conftest import CSRF, INICIO, crear_cita, crear_cliente, sobandero_con_horario
from tests.test_publico_citas import datos

NUEVA = INICIO + timedelta(days=1)  # martes 10:00 en Bogotá


def agendar(api: TestClient, sesion: Session) -> tuple[str, int]:
    sobandero = sobandero_con_horario(sesion)
    cuerpo = api.post("/publico/citas", json=datos(sobandero.id), headers=CSRF).json()
    return cuerpo["token"], sobandero.id


def test_ver_la_cita(api: TestClient, sesion: Session) -> None:
    token, sobandero_id = agendar(api, sesion)
    respuesta = api.get(f"/mi-cita/{token}")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "agendada" and cuerpo["duracion_min"] == 30
    assert cuerpo["sobandero"]["id"] == sobandero_id
    assert "celular" not in respuesta.text


def test_token_desconocido_da_410(api: TestClient) -> None:
    respuesta = api.get("/mi-cita/no-existe")
    assert respuesta.status_code == 410
    assert respuesta.json()["codigo"] == "enlace_vencido"


def test_enlace_vencido_da_410(api: TestClient, sesion: Session) -> None:
    token, _ = agendar(api, sesion)
    enlace = sesion.scalars(select(EnlaceCita)).one()
    enlace.vence_en = datetime(2029, 12, 31, tzinfo=UTC)
    sesion.flush()
    assert api.get(f"/mi-cita/{token}").status_code == 410
    assert api.post(f"/mi-cita/{token}/cancelar", headers=CSRF).status_code == 410


def test_reprogramar_mueve_la_cita_y_conserva_el_enlace(api: TestClient, sesion: Session) -> None:
    token, _ = agendar(api, sesion)
    respuesta = api.post(
        f"/mi-cita/{token}/reprogramar", json={"inicio": NUEVA.isoformat()}, headers=CSRF
    )
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["inicio"] == "2030-01-08T15:00:00Z"
    citas = {c.estado: c for c in sesion.scalars(select(Cita))}
    assert citas["cancelada"].inicio == INICIO and citas["cancelada"].cancelada_por == "cliente"
    assert citas["agendada"].inicio == NUEVA
    # El mismo enlace sigue sirviendo y apunta a la cita nueva.
    assert api.get(f"/mi-cita/{token}").json()["inicio"] == "2030-01-08T15:00:00Z"
    enlace = sesion.scalars(select(EnlaceCita)).one()
    assert enlace.cita_id == citas["agendada"].id and enlace.token_hash == hash_token(token)
    assert enlace.vence_en == NUEVA.replace(hour=5) + timedelta(days=2)


def test_reprogramar_crea_cita_cambiada_y_cancela_lo_pendiente(
    api: TestClient, sesion: Session
) -> None:
    token, _ = agendar(api, sesion)
    api.post(f"/mi-cita/{token}/reprogramar", json={"inicio": NUEVA.isoformat()}, headers=CSRF)
    vieja = sesion.scalars(select(Cita).where(Cita.estado == "cancelada")).one()
    nueva = sesion.scalars(select(Cita).where(Cita.estado == "agendada")).one()
    de_vieja = sesion.scalars(select(Notificacion).where(Notificacion.cita_id == vieja.id)).all()
    assert all(n.estado == "cancelada" for n in de_vieja)  # confirmación y recordatorio viejos
    de_nueva = {
        n.tipo: n
        for n in sesion.scalars(select(Notificacion).where(Notificacion.cita_id == nueva.id))
    }
    assert de_nueva["reprogramacion"].plantilla == "cita_cambiada"
    assert de_nueva["reprogramacion"].estado == "pendiente"
    assert de_nueva["reprogramacion"].variables["token"] == token
    assert de_nueva["recordatorio"].estado == "pendiente"


def test_reprogramar_a_hora_ocupada_no_deja_al_cliente_sin_cita(
    api: TestClient, sesion: Session
) -> None:
    token, sobandero_id = agendar(api, sesion)
    sobandero = sesion.get(Sobandero, sobandero_id)
    assert sobandero is not None
    crear_cita(sesion, sobandero, crear_cliente(sesion, 7), NUEVA)
    antes = sesion.scalars(select(Notificacion)).all()
    respuesta = api.post(
        f"/mi-cita/{token}/reprogramar", json={"inicio": NUEVA.isoformat()}, headers=CSRF
    )
    assert respuesta.status_code == 409
    assert respuesta.json()["codigo"] == "hora_ocupada"
    assert 1 <= len(respuesta.json()["alternativas"]) <= 3
    # La cita original sigue agendada, el enlace apunta a ella y no hay avisos nuevos.
    assert api.get(f"/mi-cita/{token}").json()["estado"] == "agendada"
    assert api.get(f"/mi-cita/{token}").json()["inicio"] == "2030-01-07T15:00:00Z"
    assert all(n.estado == "pendiente" for n in sesion.scalars(select(Notificacion)))
    assert len(sesion.scalars(select(Notificacion)).all()) == len(antes)


def test_reprogramar_a_un_horario_que_se_cruza_con_la_propia_cita(
    api: TestClient, sesion: Session
) -> None:
    token, _ = agendar(api, sesion)
    corrida = INICIO + timedelta(minutes=30)  # 10:30, justo al lado de la actual
    respuesta = api.post(
        f"/mi-cita/{token}/reprogramar", json={"inicio": corrida.isoformat()}, headers=CSRF
    )
    assert respuesta.status_code == 200


def test_cancelar_libera_la_hora_y_avisa(api: TestClient, sesion: Session) -> None:
    token, sobandero_id = agendar(api, sesion)
    respuesta = api.post(f"/mi-cita/{token}/cancelar", headers=CSRF)
    assert respuesta.status_code == 200 and respuesta.json()["estado"] == "cancelada"
    assert respuesta.json()["puede_modificar"] is False
    cita = sesion.scalars(select(Cita)).one()
    assert cita.cancelada_por == "cliente"
    notis = {n.tipo: n for n in sesion.scalars(select(Notificacion))}
    assert notis["cancelacion"].plantilla == "cita_cancelada"
    assert (
        notis["confirmacion"].estado == "cancelada" and notis["recordatorio"].estado == "cancelada"
    )
    horas = api.get(f"/publico/sobanderos/{sobandero_id}/horas", params={"dia": "2030-01-07"})
    assert "2030-01-07T15:00:00Z" in horas.json()["horas"]
    # El enlace sigue mostrando «cancelada», pero ya no deja cambiar nada.
    assert api.get(f"/mi-cita/{token}").json()["estado"] == "cancelada"
    otra = api.post(f"/mi-cita/{token}/cancelar", headers=CSRF)
    assert otra.status_code == 409 and otra.json()["codigo"] == "cita_no_modificable"
    assert (
        api.post(
            f"/mi-cita/{token}/reprogramar", json={"inicio": NUEVA.isoformat()}, headers=CSRF
        ).status_code
        == 409
    )


def test_acciones_exigen_encabezado_csrf(api: TestClient, sesion: Session) -> None:
    token, _ = agendar(api, sesion)
    assert api.post(f"/mi-cita/{token}/cancelar").status_code == 403

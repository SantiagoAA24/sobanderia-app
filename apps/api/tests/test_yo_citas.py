"""Citas del sobandero: ver, crear a mano, marcar, cambiar la hora y cancelar."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modelos import Cita, Notificacion
from tests.conftest import (
    CSRF,
    INICIO,
    crear_cita,
    crear_cliente,
    crear_usuario,
    ingresar,
    sobandero_con_login,
)

NUEVA = INICIO + timedelta(days=1)


def entrar(api: TestClient, sesion: Session, numero: int = 1):  # type: ignore[no-untyped-def]
    sobandero = sobandero_con_login(sesion, numero)
    assert ingresar(api, sobandero.usuario.correo).status_code == 200
    return sobandero


def test_sin_sesion_da_401(api: TestClient) -> None:
    assert api.get("/yo/citas").status_code == 401
    assert api.post("/yo/citas", json={}, headers=CSRF).status_code == 401
    assert api.patch("/yo/citas/1", json={}, headers=CSRF).status_code == 401


def test_admin_sin_perfil_de_sobandero_da_403(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion, "admin@sobanderia.test", rol="admin", debe_cambiar_clave=False)
    ingresar(api, "admin@sobanderia.test")
    assert api.get("/yo/citas").status_code == 403


def test_listar_por_dia_y_por_semana(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    crear_cita(sesion, yo, crear_cliente(sesion, 1), INICIO)
    crear_cita(sesion, yo, crear_cliente(sesion, 2), INICIO - timedelta(hours=1))
    crear_cita(sesion, yo, crear_cliente(sesion, 3), NUEVA)
    crear_cita(sesion, yo, crear_cliente(sesion, 4), INICIO + timedelta(days=7))
    crear_cita(
        sesion, yo, crear_cliente(sesion, 5), INICIO + timedelta(hours=1), estado="cancelada"
    )

    dia = api.get("/yo/citas", params={"dia": "2030-01-07"}).json()
    assert [c["inicio"] for c in dia] == ["2030-01-07T14:00:00Z", "2030-01-07T15:00:00Z"]
    assert dia[0]["cliente"]["celular"].startswith("+57")

    semana = api.get("/yo/citas", params={"semana": "2030-01-09"}).json()  # miércoles
    assert len(semana) == 3  # lunes 7 (dos) y martes 8; no la del lunes siguiente

    con_canceladas = api.get("/yo/citas", params={"dia": "2030-01-07", "incluir_canceladas": True})
    assert len(con_canceladas.json()) == 3

    assert (
        api.get("/yo/citas", params={"dia": "2030-01-07", "semana": "2030-01-07"}).status_code
        == 422
    )


def test_no_ve_citas_de_otro_sobandero(api: TestClient, sesion: Session) -> None:
    otro = sobandero_con_login(sesion, 2)
    crear_cita(sesion, otro, crear_cliente(sesion, 1))
    entrar(api, sesion, 1)
    assert api.get("/yo/citas", params={"dia": "2030-01-07"}).json() == []


def test_no_puede_tocar_citas_de_otro_sobandero(api: TestClient, sesion: Session) -> None:
    otro = sobandero_con_login(sesion, 2)
    ajena = crear_cita(sesion, otro, crear_cliente(sesion, 1))
    entrar(api, sesion, 1)
    for cuerpo in ({"estado": "cancelada"}, {"estado": "atendida"}, {"inicio": NUEVA.isoformat()}):
        respuesta = api.patch(f"/yo/citas/{ajena.id}", json=cuerpo, headers=CSRF)
        assert respuesta.status_code == 404, cuerpo
    assert sesion.get(Cita, ajena.id).estado == "agendada"  # type: ignore[union-attr]


def test_cita_manual_crea_cita_y_confirmacion(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    cuerpo = {"nombre": "Don José", "celular": "310 555 1234", "inicio": INICIO.isoformat()}
    respuesta = api.post("/yo/citas", json=cuerpo, headers=CSRF)
    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["origen"] == "sobandero"
    cita = sesion.scalars(select(Cita)).one()
    assert cita.sobandero_id == yo.id
    tipos = {n.tipo: n.plantilla for n in sesion.scalars(select(Notificacion))}
    assert tipos["confirmacion"] == "cita_confirmada"


def test_cita_manual_sobre_hora_ocupada_da_409(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    crear_cita(sesion, yo, crear_cliente(sesion, 1))
    cuerpo = {"nombre": "Don José", "celular": "310 555 1234", "inicio": INICIO.isoformat()}
    respuesta = api.post("/yo/citas", json=cuerpo, headers=CSRF)
    assert respuesta.status_code == 409 and respuesta.json()["codigo"] == "hora_ocupada"
    assert len(respuesta.json()["alternativas"]) == 3


def test_marcar_atendida_y_no_asistio_no_avisa(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    una = crear_cita(sesion, yo, crear_cliente(sesion, 1))
    otra = crear_cita(sesion, yo, crear_cliente(sesion, 2), INICIO + timedelta(hours=1))
    assert (
        api.patch(f"/yo/citas/{una.id}", json={"estado": "atendida"}, headers=CSRF).json()["estado"]
        == "atendida"
    )
    r = api.patch(f"/yo/citas/{otra.id}", json={"estado": "no_asistio"}, headers=CSRF)
    assert r.json()["estado"] == "no_asistio"
    assert sesion.scalars(select(Notificacion)).all() == []
    # Ya cerrada: no se vuelve a cambiar.
    r = api.patch(f"/yo/citas/{una.id}", json={"estado": "cancelada"}, headers=CSRF)
    assert r.status_code == 409 and r.json()["codigo"] == "cita_no_modificable"


def test_cancelar_con_aviso_y_sin_aviso(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    con = crear_cita(sesion, yo, crear_cliente(sesion, 1))
    sin = crear_cita(sesion, yo, crear_cliente(sesion, 2), INICIO + timedelta(hours=1))
    api.patch(f"/yo/citas/{con.id}", json={"estado": "cancelada"}, headers=CSRF)
    api.patch(f"/yo/citas/{sin.id}", json={"estado": "cancelada", "avisar": False}, headers=CSRF)
    assert sesion.get(Cita, con.id).cancelada_por == "sobandero"  # type: ignore[union-attr]
    notis = sesion.scalars(select(Notificacion)).all()
    assert [(n.cita_id, n.plantilla) for n in notis] == [(con.id, "cita_cancelada_sobandero")]


def test_cambiar_hora_con_aviso_rota_el_enlace(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    # La cita nace por la ruta pública para tener enlace y token.
    token = api.post(
        "/publico/citas",
        json={
            "sobandero_id": yo.id,
            "inicio": INICIO.isoformat(),
            "nombre": "Ana",
            "celular": "3001112233",
            "consentimiento": True,
        },
        headers=CSRF,
    ).json()["token"]
    cita = sesion.scalars(select(Cita)).one()
    r = api.patch(f"/yo/citas/{cita.id}", json={"inicio": NUEVA.isoformat()}, headers=CSRF)
    assert r.status_code == 200 and r.json()["inicio"] == "2030-01-08T15:00:00Z"
    assert r.json()["id"] != cita.id
    cambiada = sesion.scalars(
        select(Notificacion).where(Notificacion.tipo == "reprogramacion")
    ).one()
    nuevo = cambiada.variables["token"]
    assert nuevo != token
    assert api.get(f"/mi-cita/{token}").status_code == 410  # el viejo ya no sirve
    assert api.get(f"/mi-cita/{nuevo}").json()["inicio"] == "2030-01-08T15:00:00Z"


def test_cambiar_hora_sin_aviso_no_envia_nada_ni_rota_el_enlace(
    api: TestClient, sesion: Session
) -> None:
    yo = entrar(api, sesion)
    token = api.post(
        "/publico/citas",
        json={
            "sobandero_id": yo.id,
            "inicio": INICIO.isoformat(),
            "nombre": "Ana",
            "celular": "3001112233",
            "consentimiento": True,
        },
        headers=CSRF,
    ).json()["token"]
    cita = sesion.scalars(select(Cita)).one()
    api.patch(
        f"/yo/citas/{cita.id}", json={"inicio": NUEVA.isoformat(), "avisar": False}, headers=CSRF
    )
    assert (
        sesion.scalars(select(Notificacion).where(Notificacion.tipo == "reprogramacion")).all()
        == []
    )
    assert api.get(f"/mi-cita/{token}").json()["inicio"] == "2030-01-08T15:00:00Z"


def test_cambiar_hora_a_ocupada_deja_todo_igual(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    cita = crear_cita(sesion, yo, crear_cliente(sesion, 1))
    crear_cita(sesion, yo, crear_cliente(sesion, 2), NUEVA)
    r = api.patch(f"/yo/citas/{cita.id}", json={"inicio": NUEVA.isoformat()}, headers=CSRF)
    assert r.status_code == 409
    assert sesion.get(Cita, cita.id).estado == "agendada"  # type: ignore[union-attr]


def test_cuerpo_ambiguo_da_422(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    cita = crear_cita(sesion, yo, crear_cliente(sesion, 1))
    for cuerpo in ({}, {"estado": "atendida", "inicio": NUEVA.isoformat()}, {"estado": "borrada"}):
        assert api.patch(f"/yo/citas/{cita.id}", json=cuerpo, headers=CSRF).status_code == 422

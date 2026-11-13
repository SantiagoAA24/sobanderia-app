"""Resumen del día, agenda de todos, datos del negocio y registro de actividad."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modelos import Auditoria, Negocio
from tests.conftest import (
    CSRF,
    INICIO,
    crear_cita,
    crear_cliente,
    sobandero_con_login,
)
from tests.test_admin_sobanderos import entrar_admin


def test_resumen_del_dia(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    marcela = sobandero_con_login(sesion, 2)
    sobandero_con_login(sesion, 3)  # sin citas hoy
    baja = sobandero_con_login(sesion, 4)
    baja.usuario.activo = False
    crear_cita(sesion, carlos, crear_cliente(sesion, 1), INICIO)
    crear_cita(sesion, carlos, crear_cliente(sesion, 2), INICIO + timedelta(hours=1))
    crear_cita(sesion, marcela, crear_cliente(sesion, 3), INICIO + timedelta(minutes=30))
    crear_cita(
        sesion, marcela, crear_cliente(sesion, 4), INICIO + timedelta(hours=2), estado="cancelada"
    )
    crear_cita(sesion, carlos, crear_cliente(sesion, 5), INICIO + timedelta(days=1))  # otro día

    r = api.get("/admin/resumen", params={"dia": "2030-01-07"})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["dia"] == "2030-01-07"
    assert cuerpo["citas_total"] == 3  # sin canceladas
    assert cuerpo["sobanderos_atendiendo"] == 2
    por = {s["nombre"]: s for s in cuerpo["por_sobandero"]}
    assert set(por) == {s.usuario.nombre for s in (carlos, marcela)} | {
        "Sobandero 3"
    }  # sin dado de baja
    assert por[carlos.usuario.nombre]["citas"] == 2
    assert por[carlos.usuario.nombre]["siguiente"] == "2030-01-07T15:00:00Z"
    assert por["Sobandero 3"]["citas"] == 0 and por["Sobandero 3"]["siguiente"] is None


def test_agenda_de_todos_sin_celulares_ni_canceladas(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    marcela = sobandero_con_login(sesion, 2)
    crear_cita(sesion, marcela, crear_cliente(sesion, 1), INICIO + timedelta(minutes=30))
    crear_cita(sesion, carlos, crear_cliente(sesion, 2), INICIO)
    crear_cita(
        sesion, carlos, crear_cliente(sesion, 3), INICIO + timedelta(hours=1), estado="cancelada"
    )
    crear_cita(sesion, carlos, crear_cliente(sesion, 4), INICIO + timedelta(days=1))

    r = api.get("/admin/agenda", params={"dia": "2030-01-07"})
    assert r.status_code == 200
    filas = r.json()
    assert [f["inicio"] for f in filas] == ["2030-01-07T15:00:00Z", "2030-01-07T15:30:00Z"]
    assert [f["sobandero"]["nombre"] for f in filas] == [
        carlos.usuario.nombre,
        marcela.usuario.nombre,
    ]
    assert filas[0]["cliente_nombre"] == "Cliente 2"
    assert "+57" not in r.text and "celular" not in r.text


def test_ver_y_guardar_los_datos_del_negocio(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    sesion.add(
        Negocio(
            id=1,
            nombre="Sobandería",
            direccion="Calle 1",
            telefono="+573001112233",
            mensaje_bienvenida="Hola",
        )
    )
    sesion.flush()
    assert api.get("/admin/negocio").json()["direccion"] == "Calle 1"

    nuevos = {
        "nombre": " Sobandería La Esperanza ",
        "direccion": "Carrera 7 # 12-34",
        "telefono": "+573004445566",
        "mensaje_bienvenida": "Agende su cita en un minuto.",
    }
    r = api.put("/admin/negocio", json=nuevos, headers=CSRF)
    assert r.status_code == 200 and r.json()["nombre"] == "Sobandería La Esperanza"
    # Lo que guarda el admin es lo que ve el cliente en Inicio.
    assert TestClient(api.app).get("/publico/negocio").json() == r.json()
    assert api.put("/admin/negocio", json=nuevos | {"nombre": ""}, headers=CSRF).status_code == 422
    assert (
        api.put("/admin/negocio", json=nuevos | {"telefono": "abc"}, headers=CSRF).status_code
        == 422
    )
    assert [a.accion for a in sesion.scalars(select(Auditoria))] == ["negocio_editado"]


def test_registro_de_actividad(api: TestClient, sesion: Session) -> None:
    admin = entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    api.patch(f"/admin/sobanderos/{carlos.id}", json={"duracion_min": 45}, headers=CSRF)
    api.post(f"/admin/sobanderos/{carlos.id}/enlace-clave", headers=CSRF)
    # Un detalle con datos que nunca deben salir.
    sesion.add(
        Auditoria(
            usuario_id=admin.id, accion="otra", entidad="x", detalle={"celular": "+573001234567"}
        )
    )
    sesion.flush()

    r = api.get("/admin/actividad")
    assert r.status_code == 200
    filas = r.json()
    assert [f["accion"] for f in filas] == [
        "otra",
        "enlace_clave_enviado",
        "sobandero_editado",
    ]  # lo último primero
    assert filas[2]["quien"] == admin.nombre
    assert carlos.usuario.nombre in filas[2]["texto"]
    assert "+573001234567" not in r.text

    pagina = api.get("/admin/actividad", params={"limite": 1}).json()
    assert len(pagina) == 1
    siguiente = api.get("/admin/actividad", params={"limite": 5, "antes": pagina[0]["id"]}).json()
    assert [f["accion"] for f in siguiente] == ["enlace_clave_enviado", "sobandero_editado"]
    assert api.get("/admin/actividad", params={"limite": 500}).status_code == 422

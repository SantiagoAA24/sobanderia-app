"""Panel del administrador: permisos, crear sobanderos y editarlos."""

import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modelos import Auditoria, Sesion, Sobandero, Usuario
from app.seguridad.claves import verificar_clave
from tests.conftest import (
    CLAVE,
    CSRF,
    CorreoEspia,
    crear_usuario,
    ingresar,
    sobandero_con_login,
)

CORREO_ADMIN = "admin@sobanderia.test"
TEMPORAL = "temporal-123"


def entrar_admin(api: TestClient, sesion: Session) -> Usuario:
    admin = crear_usuario(sesion, CORREO_ADMIN, rol="admin")
    assert ingresar(api, CORREO_ADMIN).status_code == 200
    return admin


def nuevo(**cambios: object) -> dict[str, object]:
    return {
        "nombre": "Juliana Ríos",
        "correo": "juliana@sobanderia.test",
        "clave_temporal": TEMPORAL,
        "duracion_min": 30,
    } | cambios


RUTAS = [
    ("GET", "/admin/resumen"),
    ("GET", "/admin/agenda"),
    ("GET", "/admin/sobanderos"),
    ("POST", "/admin/sobanderos"),
    ("GET", "/admin/sobanderos/1"),
    ("PATCH", "/admin/sobanderos/1"),
    ("GET", "/admin/sobanderos/1/horario"),
    ("PUT", "/admin/sobanderos/1/horario"),
    ("POST", "/admin/sobanderos/1/baja"),
    ("POST", "/admin/sobanderos/1/enlace-clave"),
    ("GET", "/admin/negocio"),
    ("PUT", "/admin/negocio"),
    ("GET", "/admin/actividad"),
]


@pytest.mark.parametrize(("metodo", "ruta"), RUTAS)
def test_sin_sesion_da_401(api: TestClient, metodo: str, ruta: str) -> None:
    assert api.request(metodo, ruta, json={}, headers=CSRF).status_code == 401


@pytest.mark.parametrize(("metodo", "ruta"), RUTAS)
def test_un_sobandero_recibe_403_en_cada_ruta_admin(
    api: TestClient, sesion: Session, metodo: str, ruta: str
) -> None:
    sobandero = sobandero_con_login(sesion)
    ingresar(api, sobandero.usuario.correo)
    assert api.request(metodo, ruta, json={}, headers=CSRF).status_code == 403


def test_un_admin_con_clave_temporal_pendiente_no_entra(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion, CORREO_ADMIN, rol="admin", debe_cambiar_clave=True)
    ingresar(api, CORREO_ADMIN)
    r = api.get("/admin/sobanderos")
    assert (r.status_code, r.json()["codigo"]) == (403, "debe_cambiar_clave")


def test_crear_un_sobandero_guarda_la_clave_temporal_con_hash_y_no_la_devuelve(
    api: TestClient, sesion: Session, caplog: pytest.LogCaptureFixture
) -> None:
    admin = entrar_admin(api, sesion)
    with caplog.at_level(logging.DEBUG):
        r = api.post("/admin/sobanderos", json=nuevo(), headers=CSRF)
    assert r.status_code == 201
    cuerpo = r.json()
    assert cuerpo["nombre"] == "Juliana Ríos"
    assert cuerpo["correo"] == "juliana@sobanderia.test"
    assert cuerpo["duracion_min"] == 30
    assert cuerpo["recibe_citas"] is True and cuerpo["activo"] is True
    assert TEMPORAL not in r.text
    assert TEMPORAL not in caplog.text

    usuario = sesion.scalar(select(Usuario).where(Usuario.correo == "juliana@sobanderia.test"))
    assert usuario is not None
    assert usuario.rol == "sobandero" and usuario.debe_cambiar_clave is True
    assert usuario.clave_hash.startswith("$argon2id$")
    assert verificar_clave(usuario.clave_hash, TEMPORAL)

    # Ni la lista ni la ficha la repiten.
    assert TEMPORAL not in api.get("/admin/sobanderos").text
    assert TEMPORAL not in api.get(f"/admin/sobanderos/{cuerpo['id']}").text

    auditoria = sesion.scalars(
        select(Auditoria).where(Auditoria.accion == "sobandero_creado")
    ).one()
    assert auditoria.usuario_id == admin.id
    assert TEMPORAL not in str(auditoria.detalle)


def test_el_sobandero_nuevo_entra_con_la_clave_temporal_y_la_cambia(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    entrar_admin(api, sesion)
    assert api.post("/admin/sobanderos", json=nuevo(), headers=CSRF).status_code == 201
    api.post("/auth/salida", headers=CSRF)

    r = ingresar(api, "juliana@sobanderia.test", TEMPORAL)
    assert r.status_code == 200 and r.json()["debe_cambiar_clave"] is True
    # Con la clave temporal pendiente no abre su panel.
    assert api.get("/yo/citas").json()["codigo"] == "debe_cambiar_clave"

    cambio = {"clave_actual": TEMPORAL, "clave_nueva": "mi-clave-nueva-1"}
    assert api.post("/auth/cambiar-clave", json=cambio, headers=CSRF).status_code == 204
    assert api.get("/yo/citas").status_code == 200
    # El admin no puede abrir la zona /admin con esa cuenta.
    assert api.get("/admin/sobanderos").status_code == 403

    api.post("/auth/salida", headers=CSRF)
    assert ingresar(api, "juliana@sobanderia.test", TEMPORAL).status_code == 401
    assert ingresar(api, "juliana@sobanderia.test", "mi-clave-nueva-1").status_code == 200


def test_crear_valida_los_datos(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    for malo in (
        nuevo(clave_temporal="corta"),
        nuevo(correo="sin-arroba"),
        nuevo(duracion_min=25),
        nuevo(nombre="J"),
    ):
        assert api.post("/admin/sobanderos", json=malo, headers=CSRF).status_code == 422
    assert api.post("/admin/sobanderos", json=nuevo(), headers=CSRF).status_code == 201
    repetido = api.post(
        "/admin/sobanderos", json=nuevo(correo="JULIANA@sobanderia.test"), headers=CSRF
    )
    assert (repetido.status_code, repetido.json()["codigo"]) == (409, "correo_en_uso")


def test_lista_y_ficha(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    marcela = sobandero_con_login(sesion, 2, duracion=45)
    marcela.usuario.activo = False
    sesion.flush()

    lista = api.get("/admin/sobanderos").json()
    assert [s["id"] for s in lista] == [carlos.id]  # los dados de baja no salen
    assert lista[0]["dias"] == [0, 1, 2, 3, 4]
    assert [
        s["id"] for s in api.get("/admin/sobanderos", params={"incluir_inactivos": True}).json()
    ] == [
        carlos.id,
        marcela.id,
    ]

    ficha = api.get(f"/admin/sobanderos/{carlos.id}").json()
    assert ficha["correo"] == carlos.usuario.correo
    assert ficha["citas_proximas"] == 0
    assert api.get("/admin/sobanderos/99999").status_code == 404


def test_editar_correo_recibe_citas_y_duracion(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    anterior = carlos.usuario.correo
    r = api.patch(
        f"/admin/sobanderos/{carlos.id}",
        json={"correo": " Nuevo@Sobanderia.test ", "duracion_min": 45, "recibe_citas": False},
        headers=CSRF,
    )
    assert r.status_code == 200
    assert (r.json()["correo"], r.json()["duracion_min"], r.json()["recibe_citas"]) == (
        "nuevo@sobanderia.test",
        45,
        False,
    )
    assert [d for d, _, _ in correo.enviados] == [anterior]  # se avisa al correo anterior
    assert (
        api.patch(
            f"/admin/sobanderos/{carlos.id}", json={"duracion_min": 50}, headers=CSRF
        ).status_code
        == 422
    )

    otro = sobandero_con_login(sesion, 2)
    choque = api.patch(
        f"/admin/sobanderos/{carlos.id}", json={"correo": otro.usuario.correo}, headers=CSRF
    )
    assert (choque.status_code, choque.json()["codigo"]) == (409, "correo_en_uso")


def test_cambiar_la_duracion_no_toca_las_citas_ya_agendadas(
    api: TestClient, sesion: Session
) -> None:
    from tests.conftest import INICIO, crear_cita, crear_cliente

    entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    cita = crear_cita(sesion, carlos, crear_cliente(sesion), INICIO, minutos=30)
    api.patch(f"/admin/sobanderos/{carlos.id}", json={"duracion_min": 60}, headers=CSRF)
    sesion.refresh(cita)
    assert (cita.fin - cita.inicio).total_seconds() == 30 * 60


def test_horario_del_sobandero(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    r = api.get(f"/admin/sobanderos/{carlos.id}/horario")
    assert r.status_code == 200 and r.json()["duracion_min"] == 30
    lunes = r.json()["dias"][0]
    assert lunes["franjas"] == [
        {"desde": "08:00", "hasta": "12:00"},
        {"desde": "14:00", "hasta": "18:00"},
    ]

    nuevo_lunes = {"dias": [{"dia_semana": 0, "franjas": [{"desde": "09:00", "hasta": "13:00"}]}]}
    r = api.put(f"/admin/sobanderos/{carlos.id}/horario", json=nuevo_lunes, headers=CSRF)
    assert r.status_code == 200
    assert r.json()["dias"][0]["franjas"] == [{"desde": "09:00", "hasta": "13:00"}]
    cruzado = {
        "dias": [
            {
                "dia_semana": 1,
                "franjas": [
                    {"desde": "09:00", "hasta": "11:00"},
                    {"desde": "10:00", "hasta": "12:00"},
                ],
            }
        ]
    }
    assert (
        api.put(f"/admin/sobanderos/{carlos.id}/horario", json=cruzado, headers=CSRF).status_code
        == 422
    )
    assert api.get("/admin/sobanderos/99999/horario").status_code == 404


def test_enlace_para_cambiar_la_clave(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    r = api.post(f"/admin/sobanderos/{carlos.id}/enlace-clave", headers=CSRF)
    assert r.status_code == 204
    destino, asunto, cuerpo = correo.enviados[-1]
    assert destino == carlos.usuario.correo and "/restablecer/" in cuerpo
    assert api.post("/admin/sobanderos/99999/enlace-clave", headers=CSRF).status_code == 404


def test_cada_cambio_deja_su_rastro_sin_datos_sensibles(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    api.post("/admin/sobanderos", json=nuevo(), headers=CSRF)
    api.patch(f"/admin/sobanderos/{carlos.id}", json={"duracion_min": 45}, headers=CSRF)
    api.put(f"/admin/sobanderos/{carlos.id}/horario", json={"dias": []}, headers=CSRF)
    api.post(f"/admin/sobanderos/{carlos.id}/enlace-clave", headers=CSRF)
    acciones = [a.accion for a in sesion.scalars(select(Auditoria).order_by(Auditoria.id))]
    assert acciones == [
        "sobandero_creado",
        "sobandero_editado",
        "horario_editado",
        "enlace_clave_enviado",
    ]
    for fila in sesion.scalars(select(Auditoria)):
        assert CLAVE not in str(fila.detalle) and TEMPORAL not in str(fila.detalle)
    # El perfil de sobandero se creó una vez por el alta.
    assert len(sesion.scalars(select(Sobandero)).all()) == 2
    assert len(sesion.scalars(select(Sesion)).all()) >= 1

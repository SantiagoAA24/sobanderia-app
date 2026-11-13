"""Perfil del sobandero: nombre y correo (el correo pide la clave actual)."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.seguridad.claves import verificar_clave
from tests.conftest import (
    CLAVE,
    CSRF,
    CorreoEspia,
    crear_usuario,
    ingresar,
    sobandero_con_login,
)


def entrar(api: TestClient, sesion: Session, numero: int = 1):  # type: ignore[no-untyped-def]
    sobandero = sobandero_con_login(sesion, numero)
    assert ingresar(api, sobandero.usuario.correo).status_code == 200
    return sobandero


def test_exige_sesion_y_perfil(api: TestClient, sesion: Session) -> None:
    assert api.get("/yo/perfil").status_code == 401
    assert api.patch("/yo/perfil", json={}, headers=CSRF).status_code == 401
    crear_usuario(sesion, "admin@sobanderia.test", rol="admin")
    ingresar(api, "admin@sobanderia.test")
    assert api.get("/yo/perfil").status_code == 403


def test_ver_perfil(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    assert api.get("/yo/perfil").json() == {
        "nombre": yo.usuario.nombre,
        "correo": yo.usuario.correo,
        "duracion_min": 30,
    }


def test_cambiar_el_nombre_no_pide_clave(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    r = api.patch("/yo/perfil", json={"nombre": "  Carlos Mejía "}, headers=CSRF)
    assert r.status_code == 200
    assert r.json()["nombre"] == "Carlos Mejía"
    assert yo.usuario.nombre == "Carlos Mejía"
    assert api.patch("/yo/perfil", json={"nombre": "C"}, headers=CSRF).status_code == 422


def test_cambiar_el_correo_pide_la_clave_actual_y_avisa_al_anterior(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    yo = entrar(api, sesion)
    anterior = yo.usuario.correo

    sin_clave = api.patch("/yo/perfil", json={"correo": "nuevo@sobanderia.test"}, headers=CSRF)
    assert sin_clave.status_code == 422

    mala = {"correo": "nuevo@sobanderia.test", "clave_actual": "no-es-la-clave"}
    r = api.patch("/yo/perfil", json=mala, headers=CSRF)
    # Con código propio: un 401 genérico haría creer al panel que la sesión venció.
    assert (r.status_code, r.json()["codigo"]) == (401, "clave_incorrecta")
    assert yo.usuario.correo == anterior

    buena = {"correo": " Nuevo@Sobanderia.test ", "clave_actual": CLAVE}
    r = api.patch("/yo/perfil", json=buena, headers=CSRF)
    assert r.status_code == 200
    assert r.json()["correo"] == "nuevo@sobanderia.test"
    assert yo.usuario.correo == "nuevo@sobanderia.test"
    assert [d for d, _, _ in correo.enviados] == [anterior]
    assert api.get("/yo/perfil").status_code == 200  # la sesión sigue


def test_correo_ya_usado_o_mal_escrito(api: TestClient, sesion: Session) -> None:
    entrar(api, sesion, 1)
    otro = sobandero_con_login(sesion, 2)
    r = api.patch(
        "/yo/perfil", json={"correo": otro.usuario.correo, "clave_actual": CLAVE}, headers=CSRF
    )
    assert (r.status_code, r.json()["codigo"]) == (409, "correo_en_uso")
    r = api.patch("/yo/perfil", json={"correo": "sin-arroba", "clave_actual": CLAVE}, headers=CSRF)
    assert r.status_code == 422


def test_cambiar_clave_con_clave_incorrecta_ya_no_parece_sesion_vencida(
    api: TestClient, sesion: Session
) -> None:
    entrar(api, sesion)
    cuerpo = {"clave_actual": "no-es-la-clave", "clave_nueva": "otra-clave-larga"}
    r = api.post("/auth/cambiar-clave", json=cuerpo, headers=CSRF)
    assert (r.status_code, r.json()["codigo"]) == (401, "clave_incorrecta")


def test_la_clave_no_cambia_al_editar_el_perfil(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    api.patch("/yo/perfil", json={"nombre": "Otro Nombre"}, headers=CSRF)
    assert verificar_clave(yo.usuario.clave_hash, CLAVE)

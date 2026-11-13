from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import IntentoIngreso, Sesion
from tests.conftest import CLAVE, CSRF, crear_usuario, ingresar

MENSAJE = "Correo o clave incorrectos."


def test_ingreso_correcto_pone_cookie_segura_y_guarda_solo_el_hash(
    api: TestClient, sesion: Session
) -> None:
    crear_usuario(sesion)
    respuesta = ingresar(api)
    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "nombre": "Ana",
        "rol": "sobandero",
        "debe_cambiar_clave": False,
    }
    cookie = respuesta.headers["set-cookie"]
    assert cookie.startswith(f"{ajustes.cookie_sesion}=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    token = respuesta.cookies[ajustes.cookie_sesion]
    guardados = sesion.scalars(select(Sesion.token_hash)).all()
    assert len(guardados) == 1
    assert token not in guardados
    assert len(guardados[0]) == 64


def test_clave_incorrecta_y_correo_inexistente_responden_igual(
    api: TestClient, sesion: Session
) -> None:
    crear_usuario(sesion)
    mala = ingresar(api, clave="otra-clave-123")
    inexistente = ingresar(api, correo="nadie@sobanderia.test")
    assert mala.status_code == inexistente.status_code == 401
    assert mala.json() == inexistente.json() == {"codigo": "no_autorizado", "mensaje": MENSAJE}
    assert "set-cookie" not in mala.headers


def test_usuario_inactivo_no_ingresa_y_la_respuesta_no_lo_delata(
    api: TestClient, sesion: Session
) -> None:
    crear_usuario(sesion, activo=False)
    respuesta = ingresar(api)
    assert respuesta.status_code == 401
    assert respuesta.json() == {"codigo": "no_autorizado", "mensaje": MENSAJE}


def test_el_correo_no_distingue_mayusculas(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    assert ingresar(api, correo="  ANA@Sobanderia.test ").status_code == 200


def test_ingreso_sin_cabecera_csrf_da_403(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    respuesta = api.post("/auth/ingreso", json={"correo": "ana@sobanderia.test", "clave": CLAVE})
    assert respuesta.status_code == 403
    assert respuesta.json()["codigo"] == "sin_permiso"


def test_cuerpo_invalido_da_422_con_codigo_estable(api: TestClient) -> None:
    respuesta = api.post("/auth/ingreso", json={"correo": "x"}, headers=CSRF)
    assert respuesta.status_code == 422
    assert respuesta.json()["codigo"] == "validacion"


def test_cinco_fallos_bloquean_incluso_con_la_clave_correcta(
    api: TestClient, sesion: Session
) -> None:
    crear_usuario(sesion)
    for _ in range(ajustes.intentos_max_correo):
        assert ingresar(api, clave="mala-clave-123").status_code == 401
    bloqueado = ingresar(api)  # clave correcta, pero ya está bloqueado
    assert bloqueado.status_code == 429
    assert bloqueado.json()["codigo"] == "demasiados_intentos"
    assert int(bloqueado.headers["retry-after"]) > 0


def test_el_bloqueo_tambien_aplica_a_correos_que_no_existen(api: TestClient) -> None:
    for _ in range(ajustes.intentos_max_correo):
        ingresar(api, correo="nadie@sobanderia.test")
    assert ingresar(api, correo="nadie@sobanderia.test").status_code == 429


def test_el_bloqueo_se_levanta_cuando_pasa_la_ventana(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    for _ in range(ajustes.intentos_max_correo):
        ingresar(api, clave="mala-clave-123")
    antes = datetime.now(UTC) - timedelta(minutes=ajustes.ventana_intentos_min + 1)
    sesion.execute(update(IntentoIngreso).values(momento=antes))
    assert ingresar(api).status_code == 200


def test_bloqueo_por_ip_aunque_cambie_el_correo(
    api: TestClient, sesion: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ajustes, "intentos_max_ip", 3)
    for numero in range(3):
        ingresar(api, correo=f"x{numero}@sobanderia.test")
    assert ingresar(api, correo="otro@sobanderia.test").status_code == 429


def test_ingreso_correcto_borra_los_fallos_del_correo(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    for _ in range(ajustes.intentos_max_correo - 1):
        ingresar(api, clave="mala-clave-123")
    assert ingresar(api).status_code == 200
    restantes = sesion.scalar(select(func.count()).select_from(IntentoIngreso))
    assert restantes == 0


def test_salida_cierra_la_sesion_y_borra_la_cookie(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    ingresar(api)
    salida = api.post("/auth/salida", headers=CSRF)
    assert salida.status_code == 204
    assert sesion.scalar(select(func.count()).select_from(Sesion)) == 0
    assert api.get("/auth/yo").status_code == 401

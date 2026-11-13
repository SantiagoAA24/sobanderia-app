from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import Sesion, Usuario
from tests.conftest import CSRF, crear_usuario, ingresar


def test_sin_cookie_da_401(api: TestClient) -> None:
    respuesta = api.get("/auth/yo")
    assert respuesta.status_code == 401
    assert respuesta.json()["codigo"] == "no_autorizado"


def test_sesion_valida_devuelve_el_usuario(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion, rol="admin")
    ingresar(api)
    respuesta = api.get("/auth/yo")
    assert respuesta.status_code == 200
    assert respuesta.json()["rol"] == "admin"


def test_sesion_vencida_da_401(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    ingresar(api)
    sesion.execute(update(Sesion).values(vence_en=datetime.now(UTC) - timedelta(seconds=1)))
    assert api.get("/auth/yo").status_code == 401


def test_cada_uso_renueva_la_inactividad_pero_nunca_pasa_del_maximo(
    api: TestClient, sesion: Session
) -> None:
    crear_usuario(sesion)
    ingresar(api)
    fila = sesion.scalars(select(Sesion)).one()
    # Sesión de 6 días y 23 horas de antigüedad: al usarla no puede pasar de los 7 días.
    fila.creado_en = datetime.now(UTC) - timedelta(days=ajustes.sesion_maxima_dias, hours=-1)
    sesion.flush()
    assert api.get("/auth/yo").status_code == 200
    sesion.refresh(fila)
    assert fila.vence_en <= fila.creado_en + timedelta(days=ajustes.sesion_maxima_dias)


def test_sesion_de_usuario_dado_de_baja_da_401(api: TestClient, sesion: Session) -> None:
    usuario = crear_usuario(sesion)
    ingresar(api)
    usuario.activo = False
    sesion.flush()
    assert api.get("/auth/yo").status_code == 401


def test_rutas_que_cambian_datos_exigen_la_cabecera_csrf(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    ingresar(api)
    sin = api.post("/auth/salida")
    assert sin.status_code == 403
    assert sin.json()["codigo"] == "sin_permiso"
    assert api.post("/auth/salida", headers=CSRF).status_code == 204


def test_un_token_inventado_da_401(api: TestClient) -> None:
    api.cookies.set(ajustes.cookie_sesion, "token-inventado")
    assert api.get("/auth/yo").status_code == 401


def test_usuario_sigue_existiendo_tras_cerrar_sesion(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    ingresar(api)
    api.post("/auth/salida", headers=CSRF)
    assert sesion.scalars(select(Usuario)).one().activo

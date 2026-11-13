"""Rutas de prueba con las dependencias de rol; las rutas /admin reales llegan en la Fase 7."""

from collections.abc import Iterator
from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.modelos import Usuario
from app.seguridad.dependencias import requiere_admin, requiere_sobandero
from tests.conftest import CSRF, crear_usuario, ingresar


@pytest.fixture(autouse=True)
def rutas_de_prueba() -> Iterator[None]:
    @app.get("/_prueba/admin")
    def solo_admin(u: Annotated[Usuario, Depends(requiere_admin)]) -> dict[str, str]:
        return {"rol": u.rol}

    @app.get("/_prueba/sobandero")
    def solo_sobandero(u: Annotated[Usuario, Depends(requiere_sobandero)]) -> dict[str, str]:
        return {"rol": u.rol}

    @app.post("/_prueba/escribir")
    def escribir(u: Annotated[Usuario, Depends(requiere_sobandero)]) -> dict[str, str]:
        return {"rol": u.rol}

    yield
    app.router.routes = [
        r for r in app.router.routes if not getattr(r, "path", "").startswith("/_prueba")
    ]


def test_sobandero_en_ruta_de_admin_da_403(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion, rol="sobandero")
    ingresar(api)
    respuesta = api.get("/_prueba/admin")
    assert respuesta.status_code == 403
    assert respuesta.json()["codigo"] == "sin_permiso"


def test_admin_entra_a_ruta_de_admin(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion, rol="admin")
    ingresar(api)
    assert api.get("/_prueba/admin").status_code == 200


def test_sobandero_entra_a_ruta_de_sobandero(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion, rol="sobandero")
    ingresar(api)
    assert api.get("/_prueba/sobandero").json() == {"rol": "sobandero"}


def test_sin_sesion_las_rutas_de_rol_dan_401(api: TestClient) -> None:
    assert api.get("/_prueba/admin").status_code == 401
    assert api.get("/_prueba/sobandero").status_code == 401


def test_las_rutas_de_rol_que_escriben_exigen_csrf(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    ingresar(api)
    assert api.post("/_prueba/escribir").status_code == 403
    assert api.post("/_prueba/escribir", headers=CSRF).status_code == 200


def test_con_clave_temporal_solo_se_permite_cambiar_la_clave(
    api: TestClient, sesion: Session
) -> None:
    crear_usuario(sesion, debe_cambiar_clave=True)
    assert ingresar(api).json()["debe_cambiar_clave"] is True
    bloqueada = api.get("/_prueba/sobandero")
    assert bloqueada.status_code == 403
    assert bloqueada.json()["codigo"] == "debe_cambiar_clave"
    assert api.get("/auth/yo").status_code == 200

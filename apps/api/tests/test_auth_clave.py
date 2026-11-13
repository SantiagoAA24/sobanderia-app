from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import Sesion, Usuario
from app.seguridad.claves import verificar_clave
from tests.conftest import CLAVE, CSRF, CorreoEspia, crear_usuario, ingresar

NUEVA = "otra-clave-larga-2"


def cambiar(api: TestClient, actual: str = CLAVE, nueva: str = NUEVA) -> int:
    cuerpo = {"clave_actual": actual, "clave_nueva": nueva}
    return api.post("/auth/cambiar-clave", json=cuerpo, headers=CSRF).status_code


def test_primer_ingreso_cambia_la_clave_y_apaga_la_bandera(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    usuario = crear_usuario(sesion, debe_cambiar_clave=True)
    ingresar(api)
    assert cambiar(api) == 204
    sesion.refresh(usuario)
    assert usuario.debe_cambiar_clave is False
    assert verificar_clave(usuario.clave_hash, NUEVA)
    assert not verificar_clave(usuario.clave_hash, CLAVE)
    assert len(correo.enviados) == 1  # aviso de que la clave cambió
    assert ingresar(api, clave=NUEVA).status_code == 200


def test_cambiar_clave_exige_la_clave_actual(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    ingresar(api)
    assert cambiar(api, actual="no-es-la-clave") == 401


def test_clave_nueva_corta_o_igual_a_la_actual_se_rechaza(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    ingresar(api)
    assert len("corta") < ajustes.clave_minimo
    assert cambiar(api, nueva="corta") == 422
    assert cambiar(api, nueva=CLAVE) == 422


def test_cambiar_clave_sin_sesion_da_401(api: TestClient) -> None:
    assert cambiar(api) == 401


def test_cambiar_clave_cierra_las_otras_sesiones_y_conserva_la_actual(
    api: TestClient, sesion: Session
) -> None:
    from app.main import app

    crear_usuario(sesion)
    ingresar(api)
    otro_celular = TestClient(app)
    assert ingresar(otro_celular).status_code == 200
    assert sesion.scalar(select(func.count()).select_from(Sesion)) == 2

    assert cambiar(api) == 204

    assert sesion.scalar(select(func.count()).select_from(Sesion)) == 1
    assert api.get("/auth/yo").status_code == 200
    assert otro_celular.get("/auth/yo").status_code == 401


def test_la_clave_no_queda_en_texto_claro(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    guardada = sesion.scalars(select(Usuario.clave_hash)).one()
    assert guardada.startswith("$argon2id$")
    assert CLAVE not in guardada

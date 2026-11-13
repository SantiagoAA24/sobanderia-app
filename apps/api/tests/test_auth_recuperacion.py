import re
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import RecuperacionClave, Sesion
from app.seguridad.claves import verificar_clave
from tests.conftest import CSRF, CorreoEspia, crear_usuario, ingresar

NUEVA = "clave-nueva-larga-3"


def recuperar(api: TestClient, correo: str = "ana@sobanderia.test") -> tuple[int, dict[str, str]]:
    r = api.post("/auth/recuperar", json={"correo": correo}, headers=CSRF)
    return r.status_code, r.json()


def restablecer(api: TestClient, token: str, clave: str = NUEVA) -> tuple[int, dict[str, str]]:
    cuerpo = {"token": token, "clave_nueva": clave}
    r = api.post("/auth/restablecer", json=cuerpo, headers=CSRF)
    return r.status_code, (r.json() if r.content else {})


def token_del_correo(correo: CorreoEspia) -> str:
    coincidencia = re.search(r"/restablecer/([\w-]+)", correo.enviados[-1][2])
    assert coincidencia
    return coincidencia.group(1)


def test_respuesta_identica_para_correo_existente_e_inexistente(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    crear_usuario(sesion)
    existente = recuperar(api)
    inexistente = recuperar(api, "nadie@sobanderia.test")
    assert existente == inexistente
    assert existente[0] == 200
    assert [e[0] for e in correo.enviados] == ["ana@sobanderia.test"]  # solo al que existe


def test_usuario_inactivo_recibe_la_misma_respuesta_y_ningun_correo(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    crear_usuario(sesion, activo=False)
    assert recuperar(api)[0] == 200
    assert correo.enviados == []


def test_el_token_se_guarda_solo_como_hash(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    crear_usuario(sesion)
    recuperar(api)
    token = token_del_correo(correo)
    fila = sesion.scalars(select(RecuperacionClave)).one()
    assert token != fila.token_hash
    assert len(fila.token_hash) == 64
    horas = (fila.vence_en - datetime.now(UTC)).total_seconds() / 3600
    assert 0 < horas <= ajustes.recuperacion_horas


def test_restablecer_cambia_la_clave_cierra_todas_las_sesiones_y_avisa(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    usuario = crear_usuario(sesion, debe_cambiar_clave=True)
    ingresar(api)
    recuperar(api)
    estado, _ = restablecer(api, token_del_correo(correo))
    assert estado == 204
    sesion.refresh(usuario)
    assert verificar_clave(usuario.clave_hash, NUEVA)
    assert usuario.debe_cambiar_clave is False
    assert sesion.scalar(select(func.count()).select_from(Sesion)) == 0
    assert len(correo.enviados) == 2  # el enlace y el aviso de cambio
    assert ingresar(api, clave=NUEVA).status_code == 200


def test_enlace_usado_dos_veces_falla_la_segunda(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    usuario = crear_usuario(sesion)
    recuperar(api)
    token = token_del_correo(correo)
    assert restablecer(api, token)[0] == 204
    estado, cuerpo = restablecer(api, token, "otra-clave-larga-4")
    assert estado == 410
    assert cuerpo["codigo"] == "enlace_vencido"
    sesion.refresh(usuario)
    assert verificar_clave(usuario.clave_hash, NUEVA)  # la segunda no cambió nada


def test_enlace_vencido_falla(api: TestClient, sesion: Session, correo: CorreoEspia) -> None:
    crear_usuario(sesion)
    recuperar(api)
    sesion.execute(update(RecuperacionClave).values(vence_en=datetime.now(UTC) - timedelta(1)))
    assert restablecer(api, token_del_correo(correo))[0] == 410


def test_token_inventado_falla_igual_que_uno_usado(api: TestClient) -> None:
    estado, cuerpo = restablecer(api, "token-inventado")
    assert estado == 410
    assert cuerpo["codigo"] == "enlace_vencido"


def test_un_enlace_nuevo_invalida_el_anterior(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    crear_usuario(sesion)
    recuperar(api)
    viejo = token_del_correo(correo)
    recuperar(api)
    assert restablecer(api, viejo)[0] == 410
    assert restablecer(api, token_del_correo(correo))[0] == 204


def test_clave_nueva_corta_se_rechaza_y_no_gasta_el_enlace(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    crear_usuario(sesion)
    recuperar(api)
    token = token_del_correo(correo)
    assert restablecer(api, token, "corta")[0] == 422
    assert restablecer(api, token)[0] == 204


def test_recuperar_tiene_limite_de_intentos(
    api: TestClient, sesion: Session, correo: CorreoEspia
) -> None:
    crear_usuario(sesion)
    for _ in range(ajustes.intentos_max_correo):
        assert recuperar(api)[0] == 200
    estado, cuerpo = recuperar(api)
    assert estado == 429
    assert cuerpo["codigo"] == "demasiados_intentos"
    assert len(correo.enviados) == ajustes.intentos_max_correo


def test_el_limite_de_recuperar_se_aplica_igual_a_correos_inexistentes(api: TestClient) -> None:
    for _ in range(ajustes.intentos_max_correo):
        recuperar(api, "nadie@sobanderia.test")
    assert recuperar(api, "nadie@sobanderia.test")[0] == 429


def test_recuperar_sin_cabecera_csrf_da_403(api: TestClient) -> None:
    r = api.post("/auth/recuperar", json={"correo": "ana@sobanderia.test"})
    assert r.status_code == 403

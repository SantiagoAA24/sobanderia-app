"""Acceso indebido, ruta por ruta (Fase 10.2). El recorrido sale del inventario real de `app`,
no de una lista escrita a mano: una ruta nueva entra sola en estas pruebas y debe entrar también
en la tabla de `docs/SEGURIDAD.md`.
"""

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.modelos import Bloqueo
from herramientas.inventario_rutas import RutaInventario, rutas
from tests.conftest import (
    CSRF,
    INICIO,
    crear_cita,
    crear_cliente,
    crear_usuario,
    ingresar,
    rango,
    sobandero_con_login,
)

DOCUMENTO = Path(__file__).resolve().parents[3] / "docs" / "SEGURIDAD.md"
CON_SESION = {"sesion_cualquiera", "sesion", "sobandero", "admin"}
ESCRIBEN = {"POST", "PUT", "PATCH", "DELETE"}


def inventario() -> list[RutaInventario]:
    return [r for r in rutas() if not r.ruta.startswith("/_prueba")]


def url(ruta: RutaInventario) -> str:
    """Rellena los parámetros de la ruta con valores que no existen."""
    return re.sub(r"\{token\}", "token-inexistente", re.sub(r"\{\w+\}", "999999", ruta.ruta))


def llamar(api: TestClient, ruta: RutaInventario, headers: dict[str, str] | None = None):  # type: ignore[no-untyped-def]
    return api.request(ruta.metodo, url(ruta), json={}, headers=headers)


def ids(ruta: RutaInventario) -> str:
    return ruta.clave


def nuevo_cliente_http() -> TestClient:
    """Otro navegador (su propio frasco de cookies) contra la misma app y la misma base."""
    return TestClient(app)


# --- La tabla de docs/SEGURIDAD.md cubre cada endpoint y solo esos ---------------------------


def endpoints_documentados() -> set[str]:
    texto = DOCUMENTO.read_text(encoding="utf-8")
    return set(re.findall(r"^\| `((?:GET|POST|PUT|PATCH|DELETE) /[^`]*)`", texto, flags=re.M))


def test_cada_endpoint_esta_en_la_tabla_de_seguridad() -> None:
    reales = {r.clave for r in inventario()}
    documentados = endpoints_documentados()
    assert reales - documentados == set(), "Faltan en docs/SEGURIDAD.md"
    assert documentados - reales == set(), "Sobran en docs/SEGURIDAD.md (ya no existen)"


def test_el_nivel_documentado_coincide_con_el_del_codigo() -> None:
    """La columna «Quién» de la tabla se compara con las dependencias reales de cada ruta."""
    texto = DOCUMENTO.read_text(encoding="utf-8")
    filas = re.findall(r"^\| `((?:GET|POST|PUT|PATCH|DELETE) /[^`]*)` \| ([^|]+) \|", texto, re.M)
    documentado = {clave: quien.strip() for clave, quien in filas}
    nombres = {
        "admin": "Administrador",
        "sobandero": "Sobandero",
        "sesion": "Cualquier sesión",
        "sesion_cualquiera": "Cualquier sesión",
        "publica": None,  # puede ser «Público», «Enlace de cita» o «Meta»: se revisa aparte
    }
    for r in inventario():
        esperado = nombres[r.nivel]
        if esperado is not None:
            assert documentado[r.clave].startswith(esperado), f"{r.clave}: {documentado[r.clave]}"
        else:
            assert not documentado[r.clave].startswith(("Administrador", "Sobandero", "Cualquier"))


# --- 401: sin sesión ---------------------------------------------------------------------------


@pytest.mark.parametrize("ruta", [r for r in inventario() if r.nivel in CON_SESION], ids=ids)
def test_sin_sesion_da_401(api: TestClient, ruta: RutaInventario) -> None:
    respuesta = llamar(api, ruta, headers=CSRF)
    assert respuesta.status_code == 401, respuesta.text
    assert respuesta.json()["codigo"] == "no_autorizado"


@pytest.mark.parametrize("ruta", [r for r in inventario() if r.nivel in CON_SESION], ids=ids)
def test_una_cookie_inventada_da_401(api: TestClient, ruta: RutaInventario) -> None:
    api.cookies.set("sobanderia_sesion", "token-que-nunca-existio")
    assert llamar(api, ruta, headers=CSRF).status_code == 401


# --- CSRF ---------------------------------------------------------------------------------------


def exigen_csrf() -> list[RutaInventario]:
    return [r for r in inventario() if "exige_csrf" in r.seguridad and r.metodo in ESCRIBEN]


@pytest.mark.parametrize("ruta", exigen_csrf(), ids=ids)
def test_escribir_sin_la_cabecera_propia_da_403(api: TestClient, ruta: RutaInventario) -> None:
    respuesta = llamar(api, ruta)  # sin X-Sobanderia
    assert respuesta.status_code == 403, respuesta.text
    assert respuesta.json()["codigo"] == "sin_permiso"


@pytest.mark.parametrize("ruta", exigen_csrf(), ids=ids)
def test_la_cabecera_propia_con_otro_valor_tampoco_sirve(
    api: TestClient, ruta: RutaInventario
) -> None:
    assert llamar(api, ruta, headers={"X-Sobanderia": "0"}).status_code == 403


def test_con_sesion_valida_pero_sin_cabecera_no_se_escribe(
    api: TestClient, sesion: Session
) -> None:
    """Una página ajena que dispare un POST con la cookie no puede cambiar nada."""
    sobandero_con_login(sesion, 1)
    ingresar(api, "sobandero1@sobanderia.test")
    cliente = crear_cliente(sesion)
    cita = crear_cita(sesion, sobandero_con_login(sesion, 2), cliente)
    for metodo, ruta in [("POST", "/yo/citas"), ("PATCH", f"/yo/citas/{cita.id}")]:
        assert api.request(metodo, ruta, json={"estado": "atendida"}).status_code == 403
    assert api.post("/auth/salida").status_code == 403
    assert api.get("/auth/yo").status_code == 200  # las lecturas no la necesitan


def test_las_rutas_que_no_exigen_csrf_son_solo_las_esperadas() -> None:
    sin = {
        r.clave for r in inventario() if r.metodo in ESCRIBEN and "exige_csrf" not in r.seguridad
    }
    # El webhook lo llama Meta (se protege con firma); no usa cookie ni cabecera propia.
    assert sin == {"POST /webhooks/whatsapp"}


# --- 403: rol equivocado ------------------------------------------------------------------------


@pytest.mark.parametrize("ruta", [r for r in inventario() if r.nivel == "admin"], ids=ids)
def test_un_sobandero_en_ruta_de_admin_da_403(
    api: TestClient, sesion: Session, ruta: RutaInventario
) -> None:
    sobandero_con_login(sesion, 1)
    assert ingresar(api, "sobandero1@sobanderia.test").status_code == 200
    respuesta = llamar(api, ruta, headers=CSRF)
    assert respuesta.status_code == 403, respuesta.text
    assert respuesta.json()["codigo"] == "sin_permiso"


@pytest.mark.parametrize("ruta", [r for r in inventario() if r.nivel == "sobandero"], ids=ids)
def test_un_admin_sin_perfil_de_sobandero_no_atiende_citas(
    api: TestClient, sesion: Session, ruta: RutaInventario
) -> None:
    crear_usuario(sesion, "admin@sobanderia.test", rol="admin")
    assert ingresar(api, "admin@sobanderia.test").status_code == 200
    respuesta = llamar(api, ruta, headers=CSRF)
    assert respuesta.status_code == 403, respuesta.text


@pytest.mark.parametrize(
    "ruta", [r for r in inventario() if r.nivel in {"admin", "sobandero", "sesion"}], ids=ids
)
def test_con_clave_temporal_pendiente_todo_da_403(
    api: TestClient, sesion: Session, ruta: RutaInventario
) -> None:
    rol = "admin" if ruta.nivel == "admin" else "sobandero"
    crear_usuario(sesion, "nuevo@sobanderia.test", rol=rol, debe_cambiar_clave=True)
    assert ingresar(api, "nuevo@sobanderia.test").status_code == 200
    respuesta = llamar(api, ruta, headers=CSRF)
    assert respuesta.status_code == 403, respuesta.text
    assert respuesta.json()["codigo"] == "debe_cambiar_clave"


def test_con_clave_temporal_solo_se_puede_ver_quien_es_y_cambiar_la_clave(
    api: TestClient, sesion: Session
) -> None:
    crear_usuario(sesion, "nuevo@sobanderia.test", debe_cambiar_clave=True)
    ingresar(api, "nuevo@sobanderia.test")
    assert api.get("/auth/yo").status_code == 200
    assert api.get("/yo/citas").status_code == 403


def test_una_cuenta_dada_de_baja_pierde_su_sesion_al_instante(
    api: TestClient, sesion: Session
) -> None:
    sobandero = sobandero_con_login(sesion, 1)
    ingresar(api, "sobandero1@sobanderia.test")
    assert api.get("/yo/citas").status_code == 200
    sobandero.usuario.activo = False
    sesion.flush()
    assert api.get("/yo/citas").status_code == 401
    assert api.get("/auth/yo").status_code == 401


# --- 404: un sobandero no ve lo de otro por el identificador ---------------------------------


def test_un_sobandero_no_lee_ni_cambia_citas_de_otro(api: TestClient, sesion: Session) -> None:
    uno = sobandero_con_login(sesion, 1)
    dos = sobandero_con_login(sesion, 2)
    cita_de_dos = crear_cita(sesion, dos, crear_cliente(sesion, 1), INICIO)
    ingresar(api, uno.usuario.correo)

    ajena = api.get(f"/yo/citas/{cita_de_dos.id}")
    inexistente = api.get("/yo/citas/999999")
    assert ajena.status_code == inexistente.status_code == 404
    assert ajena.json() == inexistente.json()  # no se puede saber si existe

    for cambio in ({"estado": "cancelada"}, {"estado": "atendida"}, {"estado": "no_asistio"}):
        respuesta = api.patch(f"/yo/citas/{cita_de_dos.id}", json=cambio, headers=CSRF)
        assert respuesta.status_code == 404, cambio
    assert cita_de_dos.estado == "agendada"


def test_un_sobandero_no_ve_la_ficha_de_un_cliente_de_otro(
    api: TestClient, sesion: Session
) -> None:
    uno = sobandero_con_login(sesion, 1)
    dos = sobandero_con_login(sesion, 2)
    cliente_de_dos = crear_cliente(sesion, 1)
    crear_cita(sesion, dos, cliente_de_dos, INICIO)
    ingresar(api, uno.usuario.correo)

    assert api.get(f"/yo/clientes/{cliente_de_dos.id}").status_code == 404
    assert api.get("/yo/clientes/999999").status_code == 404
    lista = api.get("/yo/clientes", params={"q": "300"}).json()
    assert lista == []


def test_un_sobandero_no_quita_bloqueos_de_otro(api: TestClient, sesion: Session) -> None:
    uno = sobandero_con_login(sesion, 1)
    dos = sobandero_con_login(sesion, 2)
    bloqueo = Bloqueo(sobandero_id=dos.id, rango=rango(INICIO, 60), motivo="ajeno")
    sesion.add(bloqueo)
    sesion.flush()
    ingresar(api, uno.usuario.correo)

    assert api.delete(f"/yo/bloqueos/{bloqueo.id}", headers=CSRF).status_code == 404
    assert api.delete("/yo/bloqueos/999999", headers=CSRF).status_code == 404
    assert sesion.get(Bloqueo, bloqueo.id) is not None
    assert api.get("/yo/bloqueos").json() == []


def test_dos_sobanderos_con_sesion_abierta_a_la_vez_no_se_mezclan(
    api: TestClient, sesion: Session
) -> None:
    uno = sobandero_con_login(sesion, 1)
    dos = sobandero_con_login(sesion, 2)
    crear_cita(sesion, dos, crear_cliente(sesion, 1), INICIO)
    otro = nuevo_cliente_http()
    ingresar(api, uno.usuario.correo)
    ingresar(otro, dos.usuario.correo)

    dia = INICIO.date().isoformat()
    assert api.get("/yo/citas", params={"dia": dia}).json() == []
    assert len(otro.get("/yo/citas", params={"dia": dia}).json()) == 1

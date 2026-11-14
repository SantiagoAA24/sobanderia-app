"""La app se niega a arrancar en producción con configuración de desarrollo (Fase 10.5)."""

import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from app import config
from app.config import Ajustes

RAIZ_API = Path(__file__).resolve().parent.parent

PRODUCCION: dict[str, Any] = {
    "entorno": "produccion",
    "database_url": "postgresql+psycopg://app_sobanderia:Zk8!claveLarga@bd.interna:5432/sobanderia",
    "origen_web": "https://agenda.ejemplo.co",
    "proveedor_whatsapp": "cloudapi",
    "whatsapp_token": "token-real",
    "whatsapp_phone_number_id": "1234567890",
    "whatsapp_app_secret": "secreto-real",
    "whatsapp_verify_token": "verificacion-real",
    "correo_proveedor": "smtp",
}


@pytest.fixture(autouse=True)
def hay_un_proveedor_de_correo_real(monkeypatch: pytest.MonkeyPatch) -> None:
    """Hoy no existe ninguno (H-01): se simula uno para probar las demás reglas por separado."""
    monkeypatch.setattr(config, "PROVEEDORES_CORREO_REALES", frozenset({"smtp"}))


def cargar(**cambios: Any) -> Ajustes:
    return Ajustes(_env_file=None, **{**PRODUCCION, **cambios})  # type: ignore[call-arg]


def problemas_de(**cambios: Any) -> str:
    with pytest.raises(ValidationError) as error:
        cargar(**cambios)
    return str(error.value)


def test_una_configuracion_de_produccion_completa_arranca() -> None:
    ajustes = cargar()
    assert ajustes.problemas() == []
    assert ajustes.cookie_segura


@pytest.mark.parametrize(
    "url",
    [
        # credenciales de ejemplo en un servidor que no es local
        "postgresql+psycopg://sobanderia:sobanderia@bd.interna:5432/sobanderia",
        "postgresql+psycopg://app:clave@localhost:5432/sobanderia",
        "postgresql+psycopg://app:clave@127.0.0.1:5432/sobanderia",
    ],
)
def test_la_base_de_desarrollo_no_arranca_en_produccion(url: str) -> None:
    assert "DATABASE_URL es la de desarrollo" in problemas_de(database_url=url)


def test_el_servidor_de_docker_compose_si_se_permite_con_otras_credenciales() -> None:
    """La alternativa barata del plan es una máquina con Docker Compose: el host se llama `db`."""
    assert cargar(database_url="postgresql+psycopg://app:Zk8!larga@db:5432/sobanderia")


@pytest.mark.parametrize(
    "origen", ["http://agenda.ejemplo.co", "https://localhost:5173", "http://localhost:5173", ""]
)
def test_el_origen_de_la_app_debe_ser_https_y_publico(origen: str) -> None:
    assert "ORIGEN_WEB" in problemas_de(origen_web=origen)


def test_whatsapp_falso_no_arranca_en_produccion() -> None:
    assert "PROVEEDOR_WHATSAPP" in problemas_de(proveedor_whatsapp="falso")


@pytest.mark.parametrize(
    "variable",
    ["whatsapp_token", "whatsapp_phone_number_id", "whatsapp_app_secret", "whatsapp_verify_token"],
)
def test_cada_variable_de_whatsapp_es_obligatoria(variable: str) -> None:
    mensaje = problemas_de(**{variable: ""})
    assert variable.upper() in mensaje


def test_el_correo_falso_no_arranca_en_produccion() -> None:
    mensaje = problemas_de(correo_proveedor="falso")
    assert "CORREO_PROVEEDOR" in mensaje and "H-01" in mensaje


def test_hoy_ninguna_configuracion_de_produccion_es_valida(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sin proveedor de correo real implementado, producción no puede arrancar (H-01)."""
    monkeypatch.setattr(config, "PROVEEDORES_CORREO_REALES", frozenset())
    assert "CORREO_PROVEEDOR" in problemas_de()


def test_se_listan_todos_los_problemas_juntos() -> None:
    mensaje = problemas_de(
        database_url="postgresql+psycopg://sobanderia:sobanderia@localhost/sobanderia",
        origen_web="http://localhost:5173",
        proveedor_whatsapp="falso",
        correo_proveedor="falso",
    )
    for texto in ("DATABASE_URL", "ORIGEN_WEB", "PROVEEDOR_WHATSAPP", "CORREO_PROVEEDOR"):
        assert texto in mensaje


@pytest.mark.parametrize("entorno", ["prod", "production", "staging", "Produccion", ""])
def test_un_entorno_desconocido_no_arranca(entorno: str) -> None:
    """Un error de escritura no puede dejar la app sin guardas: solo hay tres entornos."""
    assert "ENTORNO debe ser uno de" in problemas_de(entorno=entorno)


# --- Desarrollo y pruebas siguen funcionando --------------------------------------------------


def desarrollo(**cambios: Any) -> Ajustes:
    return Ajustes(_env_file=None, entorno="desarrollo", **cambios)  # type: ignore[call-arg]


def test_el_valor_por_defecto_arranca_para_desarrollar() -> None:
    ajustes = Ajustes(_env_file=None)  # type: ignore[call-arg]
    assert ajustes.entorno == "desarrollo" and not ajustes.cookie_segura


@pytest.mark.parametrize("entorno", ["desarrollo", "pruebas"])
def test_desarrollo_y_pruebas_usan_la_configuracion_de_ejemplo(entorno: str) -> None:
    assert Ajustes(_env_file=None, entorno=entorno).problemas() == []  # type: ignore[call-arg]


# --- Olvidar ENTORNO=produccion ----------------------------------------------------------------


def test_olvidar_el_entorno_con_origen_publico_no_arranca() -> None:
    with pytest.raises(ValidationError) as error:
        desarrollo(origen_web="https://agenda.ejemplo.co")
    assert "¿Falta ENTORNO=produccion?" in str(error.value)


def test_whatsapp_real_en_desarrollo_sigue_permitido() -> None:
    """Probar con el número de prueba de Meta desde un equipo de desarrollo es legítimo."""
    assert desarrollo(proveedor_whatsapp="cloudapi", whatsapp_token="t")


def test_desarrollo_con_https_local_sigue_permitido() -> None:
    assert desarrollo(origen_web="https://localhost:5173")


# --- El arranque real, en un proceso aparte ---------------------------------------------------


def arrancar(entorno: dict[str, str], *orden: str) -> subprocess.CompletedProcess[str]:
    variables = {k: v for k, v in os.environ.items() if k.upper() not in _VARIABLES}
    variables.update(entorno)
    return subprocess.run(
        [sys.executable, *orden],
        cwd=RAIZ_API,
        env=variables,
        capture_output=True,
        text=True,
        timeout=60,
    )


_VARIABLES = {n.upper() for n in Ajustes.model_fields} | {"SEED_CLAVE"}
VARIABLES_PRODUCCION = {
    "ENTORNO": "produccion",
    "DATABASE_URL": PRODUCCION["database_url"],
    "ORIGEN_WEB": PRODUCCION["origen_web"],
    "PROVEEDOR_WHATSAPP": "cloudapi",
    "WHATSAPP_TOKEN": "t",
    "WHATSAPP_PHONE_NUMBER_ID": "1",
    "WHATSAPP_APP_SECRET": "s",
    "WHATSAPP_VERIFY_TOKEN": "v",
}


@pytest.mark.parametrize(
    "orden",
    [("-c", "import app.main"), ("-m", "app.worker"), ("-m", "app.seed")],
    ids=["api", "worker", "seed"],
)
def test_ningun_proceso_arranca_en_produccion_con_valores_de_desarrollo(
    orden: tuple[str, ...],
) -> None:
    r = arrancar({"ENTORNO": "produccion"}, *orden)
    assert r.returncode != 0
    assert "La app no arranca con esta configuración" in r.stderr
    assert "DATABASE_URL es la de desarrollo" in r.stderr
    assert "Traceback" not in r.stderr  # un mensaje claro, no un volcado de pydantic


def test_con_todo_bien_menos_el_correo_solo_se_queja_del_correo() -> None:
    """Las demás reglas se cumplen con valores reales; hoy solo falta un correo que envíe."""
    r = arrancar(VARIABLES_PRODUCCION, "-c", "import app.main")
    assert r.returncode != 0
    quejas = [linea for linea in r.stderr.splitlines() if linea.startswith("  - ")]
    assert len(quejas) == 1 and "CORREO_PROVEEDOR" in quejas[0]


def test_en_desarrollo_la_app_si_importa() -> None:
    r = arrancar({"ENTORNO": "desarrollo"}, "-c", "import app.main")
    assert r.returncode == 0, r.stderr

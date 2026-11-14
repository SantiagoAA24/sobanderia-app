"""Protección común de las herramientas de extremo a extremo: solo trabajan en una base `*_e2e`."""

from sqlalchemy.engine import make_url

from app.config import ajustes

ENTORNOS = {"desarrollo", "pruebas"}


def exigir_base_e2e() -> str:
    """Devuelve la URL de la base si es segura para borrarla; si no, detiene el programa."""
    nombre = make_url(ajustes.database_url).database or ""
    if ajustes.entorno not in ENTORNOS or not nombre.endswith("_e2e"):
        raise SystemExit(
            "Las herramientas e2e solo corren con ENTORNO=desarrollo o pruebas y una base "
            f"cuyo nombre termine en _e2e (recibido: {ajustes.entorno} / {nombre or '-'})."
        )
    return ajustes.database_url

"""Deja la base e2e vacía y con los datos de ejemplo: `python -m herramientas.e2e_preparar`."""

import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text, update
from sqlalchemy.engine import make_url

from app.db import sesion_nueva
from app.modelos import Usuario
from app.seed import sembrar
from herramientas.seguridad_e2e import exigir_base_e2e

RAIZ_API = Path(__file__).resolve().parent.parent
CLAVE_E2E = os.environ.get("E2E_CLAVE", "clave-e2e-1234")


def main() -> None:
    url = exigir_base_e2e()
    destino = make_url(url)
    admin = create_engine(destino.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conexion:
        if not conexion.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": destino.database}
        ):
            conexion.execute(text(f'CREATE DATABASE "{destino.database}"'))
    admin.dispose()

    motor = create_engine(url)
    with motor.begin() as conexion:
        conexion.execute(text("DROP SCHEMA public CASCADE"))
        conexion.execute(text("CREATE SCHEMA public"))
    motor.dispose()

    config = Config(str(RAIZ_API / "alembic.ini"))
    config.set_main_option("script_location", str(RAIZ_API / "migraciones"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")

    with sesion_nueva() as sesion:
        sembrar(sesion, "desarrollo", CLAVE_E2E)
        # El primer ingreso con clave temporal se prueba aparte (recorrido del administrador).
        sesion.execute(update(Usuario).values(debe_cambiar_clave=False))
        sesion.commit()
    print("Base e2e lista.")


if __name__ == "__main__":
    main()

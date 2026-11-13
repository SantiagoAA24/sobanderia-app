"""Pruebas contra PostgreSQL real: el esquema sale de `alembic upgrade head`."""

import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import Cita, Cliente, Sobandero, Usuario

RAIZ_API = Path(__file__).resolve().parent.parent


def _url_pruebas() -> str:
    """Base aparte (`<base>_test`) para que borrar el esquema nunca toque la de desarrollo."""
    if "TEST_DATABASE_URL" in os.environ:
        return os.environ["TEST_DATABASE_URL"]
    url = make_url(ajustes.database_url)
    return url.set(database=f"{url.database}_test").render_as_string(hide_password=False)


def _crear_base_si_falta(url: str) -> None:
    destino = make_url(url)
    admin = create_engine(destino.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conexion:
        existe = conexion.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": destino.database}
        )
        if not existe:
            conexion.execute(text(f'CREATE DATABASE "{destino.database}"'))
    admin.dispose()


URL_PRUEBAS = _url_pruebas()
INICIO = datetime(2030, 1, 7, 15, 0, tzinfo=UTC)  # lunes 10:00 en Bogotá


def config_alembic(url: str = URL_PRUEBAS) -> Config:
    config = Config(str(RAIZ_API / "alembic.ini"))
    config.set_main_option("script_location", str(RAIZ_API / "migraciones"))
    config.set_main_option("sqlalchemy.url", url)
    return config


def reiniciar_esquema(motor: Engine) -> None:
    with motor.begin() as conexion:
        conexion.execute(text("DROP SCHEMA public CASCADE"))
        conexion.execute(text("CREATE SCHEMA public"))


@pytest.fixture(scope="session")
def motor() -> Iterator[Engine]:
    _crear_base_si_falta(URL_PRUEBAS)
    motor = create_engine(URL_PRUEBAS)
    reiniciar_esquema(motor)
    command.upgrade(config_alembic(), "head")
    yield motor
    motor.dispose()


@pytest.fixture
def sesion(motor: Engine) -> Iterator[Session]:
    """Cada prueba corre en una transacción que se revierte al final."""
    conexion = motor.connect()
    transaccion = conexion.begin()
    sesion = Session(bind=conexion, join_transaction_mode="create_savepoint")
    try:
        yield sesion
    finally:
        sesion.close()
        transaccion.rollback()
        conexion.close()


def rango(inicio: datetime, minutos: int = 30) -> Range[datetime]:
    return Range(inicio, inicio + timedelta(minutes=minutos), bounds="[)")


def crear_sobandero(sesion: Session, numero: int) -> Sobandero:
    usuario = Usuario(
        correo=f"sobandero{numero}@sobanderia.test",
        nombre=f"Sobandero {numero}",
        clave_hash="hash-de-prueba",
        rol="sobandero",
    )
    sobandero = Sobandero(usuario=usuario)
    sesion.add(sobandero)
    sesion.flush()
    return sobandero


def crear_cliente(sesion: Session, numero: int = 1) -> Cliente:
    cliente = Cliente(nombre=f"Cliente {numero}", celular=f"+57300000000{numero}")
    sesion.add(cliente)
    sesion.flush()
    return cliente


def crear_cita(
    sesion: Session,
    sobandero: Sobandero,
    cliente: Cliente,
    inicio: datetime = INICIO,
    minutos: int = 30,
    estado: str = "agendada",
) -> Cita:
    """Inserta una cita dentro de un savepoint para poder seguir usando la sesión si falla."""
    cita = Cita(
        sobandero_id=sobandero.id,
        cliente_id=cliente.id,
        rango=rango(inicio, minutos),
        estado=estado,
        origen="cliente",
    )
    with sesion.begin_nested():
        sesion.add(cita)
        sesion.flush()
    return cita

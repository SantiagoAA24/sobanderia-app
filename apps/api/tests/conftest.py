"""Pruebas contra PostgreSQL real: el esquema sale de `alembic upgrade head`."""

import os
from collections.abc import Iterator
from datetime import UTC, datetime, time, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import Cita, Cliente, Horario, Sobandero, Usuario

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
AHORA_PRUEBA = datetime(2030, 1, 1, 15, 0, tzinfo=UTC)  # martes 10:00 en Bogotá


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


# --- Autenticación -------------------------------------------------------------------------

CLAVE = "clave-segura-1"
CSRF = {"X-Sobanderia": "1"}


class CorreoEspia:
    """Reemplaza al enviador de correo y guarda lo que se habría enviado."""

    def __init__(self) -> None:
        self.enviados: list[tuple[str, str, str]] = []

    def enviar(self, destino: str, asunto: str, cuerpo: str) -> None:
        self.enviados.append((destino, asunto, cuerpo))


@pytest.fixture
def correo() -> CorreoEspia:
    return CorreoEspia()


@pytest.fixture
def api(sesion: Session, correo: CorreoEspia) -> Iterator[TestClient]:
    from app.correo import obtener_enviador
    from app.db import obtener_sesion
    from app.main import app
    from app.reloj import reloj

    app.dependency_overrides[obtener_sesion] = lambda: sesion
    app.dependency_overrides[obtener_enviador] = lambda: correo
    app.dependency_overrides[reloj] = lambda: AHORA_PRUEBA
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def crear_usuario(
    sesion: Session,
    correo: str = "ana@sobanderia.test",
    clave: str = CLAVE,
    rol: str = "sobandero",
    activo: bool = True,
    debe_cambiar_clave: bool = False,
) -> Usuario:
    from app.seguridad.claves import hashear_clave

    usuario = Usuario(
        correo=correo,
        nombre="Ana",
        clave_hash=hashear_clave(clave),
        rol=rol,
        activo=activo,
        debe_cambiar_clave=debe_cambiar_clave,
    )
    sesion.add(usuario)
    sesion.flush()
    return usuario


def ingresar(api: TestClient, correo: str = "ana@sobanderia.test", clave: str = CLAVE) -> Response:
    return api.post("/auth/ingreso", json={"correo": correo, "clave": clave}, headers=CSRF)


# --- Agenda ---------------------------------------------------------------------------------


def dar_horario(
    sesion: Session, sobandero: Sobandero, dia_semana: int, desde: time, hasta: time
) -> None:
    sesion.add(Horario(sobandero_id=sobandero.id, dia_semana=dia_semana, desde=desde, hasta=hasta))
    sesion.flush()


def sobandero_con_horario(sesion: Session, numero: int = 1, duracion: int = 30) -> Sobandero:
    """Lunes a viernes de 8:00 a 12:00 y de 14:00 a 18:00 (hora de Bogotá)."""
    sobandero = crear_sobandero(sesion, numero)
    sobandero.duracion_min = duracion
    for dia in range(5):
        dar_horario(sesion, sobandero, dia, time(8), time(12))
        dar_horario(sesion, sobandero, dia, time(14), time(18))
    return sobandero


def sobandero_con_login(sesion: Session, numero: int = 1, duracion: int = 30) -> Sobandero:
    """Sobandero con horario y clave `CLAVE`, listo para `ingresar(api, correo)`."""
    from app.seguridad.claves import hashear_clave

    sobandero = sobandero_con_horario(sesion, numero, duracion)
    sobandero.usuario.clave_hash = hashear_clave(CLAVE)
    sobandero.usuario.debe_cambiar_clave = False
    sesion.flush()
    return sobandero

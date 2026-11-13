from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import ajustes

CONVENCION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=CONVENCION)


# Todo se guarda en UTC: la sesión de PostgreSQL también trabaja en UTC.
motor = create_engine(ajustes.database_url, connect_args={"options": "-c timezone=UTC"})
FabricaSesion = sessionmaker(motor, expire_on_commit=False)


@contextmanager
def sesion_nueva() -> Iterator[Session]:
    with FabricaSesion() as sesion:
        yield sesion


def obtener_sesion() -> Iterator[Session]:
    """Dependencia de FastAPI: una sesión de base por petición."""
    with FabricaSesion() as sesion:
        yield sesion

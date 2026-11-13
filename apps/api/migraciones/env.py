from alembic import context
from sqlalchemy import create_engine

import app.modelos  # noqa: F401  (registra las tablas)
from app.config import ajustes
from app.db import Base

config = context.config
# Las pruebas pasan su propia URL; en el resto de los casos manda DATABASE_URL.
url = config.get_main_option("sqlalchemy.url") or ajustes.database_url
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    motor = create_engine(url, connect_args={"options": "-c timezone=UTC"})
    with motor.connect() as conexion:
        context.configure(connection=conexion, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    motor.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

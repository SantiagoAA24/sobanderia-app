from alembic import command
from sqlalchemy import Engine, inspect, text

from tests.conftest import config_alembic, reiniciar_esquema

TABLAS = {
    "usuarios",
    "sesiones",
    "sobanderos",
    "horarios",
    "bloqueos",
    "clientes",
    "citas",
    "enlaces_cita",
    "notificaciones",
    "recuperaciones_clave",
    "negocio",
    "auditoria",
    "intentos_ingreso",
}


def test_migracion_desde_cero_crea_las_trece_tablas_y_extensiones(motor: Engine) -> None:
    reiniciar_esquema(motor)
    command.upgrade(config_alembic(), "head")
    assert TABLAS <= set(inspect(motor).get_table_names())
    with motor.connect() as conexion:
        extensiones = set(conexion.scalars(text("SELECT extname FROM pg_extension")))
        restricciones = set(conexion.scalars(text("SELECT conname FROM pg_constraint")))
    assert {"btree_gist", "citext"} <= extensiones
    assert "citas_sin_cruce" in restricciones


def test_bajar_a_base_deja_la_base_vacia_y_se_puede_volver_a_subir(motor: Engine) -> None:
    config = config_alembic()
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    assert TABLAS.isdisjoint(inspect(motor).get_table_names())
    command.upgrade(config, "head")
    assert TABLAS <= set(inspect(motor).get_table_names())

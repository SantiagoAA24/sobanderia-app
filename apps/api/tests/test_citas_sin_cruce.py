"""La restricción `citas_sin_cruce` es la única garantía contra el doble agendamiento."""

from datetime import timedelta

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from tests.conftest import INICIO, crear_cita, crear_cliente, crear_sobandero


def test_cruce_total_del_mismo_sobandero_falla(sesion: Session) -> None:
    sobandero = crear_sobandero(sesion, 1)
    crear_cita(sesion, sobandero, crear_cliente(sesion, 1))
    with pytest.raises(IntegrityError, match="citas_sin_cruce"):
        crear_cita(sesion, sobandero, crear_cliente(sesion, 2))


def test_cruce_parcial_del_mismo_sobandero_falla(sesion: Session) -> None:
    sobandero = crear_sobandero(sesion, 1)
    crear_cita(sesion, sobandero, crear_cliente(sesion, 1))
    with pytest.raises(IntegrityError, match="citas_sin_cruce"):
        crear_cita(sesion, sobandero, crear_cliente(sesion, 2), INICIO + timedelta(minutes=15))


def test_citas_contiguas_no_se_cruzan(sesion: Session) -> None:
    sobandero = crear_sobandero(sesion, 1)
    crear_cita(sesion, sobandero, crear_cliente(sesion, 1))
    crear_cita(sesion, sobandero, crear_cliente(sesion, 2), INICIO + timedelta(minutes=30))
    crear_cita(sesion, sobandero, crear_cliente(sesion, 3), INICIO - timedelta(minutes=30))


def test_cita_cancelada_no_bloquea(sesion: Session) -> None:
    sobandero = crear_sobandero(sesion, 1)
    crear_cita(sesion, sobandero, crear_cliente(sesion, 1), estado="cancelada")
    crear_cita(sesion, sobandero, crear_cliente(sesion, 2))


def test_cancelar_libera_la_hora_y_reactivar_sobre_hora_ocupada_falla(sesion: Session) -> None:
    sobandero = crear_sobandero(sesion, 1)
    primera = crear_cita(sesion, sobandero, crear_cliente(sesion, 1))
    primera.estado = "cancelada"
    sesion.flush()
    crear_cita(sesion, sobandero, crear_cliente(sesion, 2))
    primera.estado = "agendada"
    with pytest.raises(IntegrityError, match="citas_sin_cruce"):
        sesion.flush()


def test_sobanderos_distintos_no_chocan(sesion: Session) -> None:
    uno = crear_sobandero(sesion, 1)
    otro = crear_sobandero(sesion, 2)
    crear_cita(sesion, uno, crear_cliente(sesion, 1))
    crear_cita(sesion, otro, crear_cliente(sesion, 2))

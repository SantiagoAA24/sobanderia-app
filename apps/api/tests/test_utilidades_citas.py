from datetime import UTC, datetime

import pytest

from app.errores import ErrorApi
from app.seguridad.celular import enmascarar, normalizar_celular
from app.servicios.formato import dia_largo, hora_12


@pytest.mark.parametrize(
    "texto",
    [
        "3001234567",
        "300 123 4567",
        "+57 300 123 4567",
        "573001234567",
        "(300) 123-4567",
        "+573001234567",
    ],
)
def test_normaliza_celulares_colombianos(texto: str) -> None:
    assert normalizar_celular(texto) == "+573001234567"


@pytest.mark.parametrize("texto", ["", "123", "abc", "2001234567", "+0123456789", "30012345678901"])
def test_rechaza_celulares_invalidos(texto: str) -> None:
    with pytest.raises(ErrorApi):
        normalizar_celular(texto)


def test_enmascara_celular() -> None:
    assert enmascarar("+573001234567") == "300 *** 4567"
    assert enmascarar("+14155550123") == "*** 0123"


def test_textos_de_fecha_y_hora_en_bogota() -> None:
    momento = datetime(2026, 11, 13, 15, 30, tzinfo=UTC)  # viernes 10:30 a. m. en Bogotá
    assert dia_largo(momento) == "viernes 13 de noviembre"
    assert hora_12(momento) == "10:30 a. m."
    assert hora_12(datetime(2026, 11, 13, 17, 0, tzinfo=UTC)) == "12:00 p. m."
    assert hora_12(datetime(2026, 11, 13, 5, 5, tzinfo=UTC)) == "12:05 a. m."
    assert hora_12(datetime(2026, 11, 13, 23, 0, tzinfo=UTC)) == "6:00 p. m."

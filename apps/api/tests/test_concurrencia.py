"""La prueba que más importa: muchas solicitudes a la misma hora y solo una gana.

A diferencia del resto, aquí cada solicitud usa su propia conexión y sus datos se confirman de
verdad (commit), porque el doble agendamiento solo aparece con transacciones simultáneas.
"""

import threading
from collections import Counter
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import ajustes
from app.db import obtener_sesion
from app.main import app
from app.modelos import Cita, Cliente, Horario, Notificacion, Sobandero, Usuario
from app.reloj import reloj
from tests.conftest import AHORA_PRUEBA, CSRF, INICIO, URL_PRUEBAS

HILOS = 20
TABLAS = (
    "notificaciones, enlaces_cita, citas, clientes, bloqueos, horarios, sobanderos, usuarios, "
    "intentos_ingreso"
)


@pytest.fixture
def motor_real(motor: Engine, monkeypatch: pytest.MonkeyPatch) -> Iterator[Engine]:
    # Aquí se prueba la restricción de la base con muchas solicitudes de un mismo lugar y celular:
    # los topes anti-abuso (por IP y por celular) tienen sus propias pruebas.
    monkeypatch.setattr(ajustes, "reservas_max_ip", 10**6)
    monkeypatch.setattr(ajustes, "citas_max_por_celular", 10**6)
    engine = create_engine(
        URL_PRUEBAS, pool_size=HILOS + 5, connect_args={"options": "-c timezone=UTC"}
    )
    vaciar(engine)
    app.dependency_overrides[obtener_sesion] = _sesion_propia(engine)
    app.dependency_overrides[reloj] = lambda: AHORA_PRUEBA
    try:
        yield engine
    finally:
        app.dependency_overrides.clear()
        vaciar(engine)
        engine.dispose()


def vaciar(engine: Engine) -> None:
    with engine.begin() as conexion:
        conexion.execute(text(f"TRUNCATE {TABLAS} RESTART IDENTITY CASCADE"))


def _sesion_propia(engine: Engine):  # type: ignore[no-untyped-def]
    fabrica = sessionmaker(engine, expire_on_commit=False)

    def dependencia() -> Iterator[Session]:
        with fabrica() as sesion:
            yield sesion

    return dependencia


@pytest.fixture
def sobandero_id(motor_real: Engine) -> int:
    with Session(motor_real) as sesion:
        usuario = Usuario(
            correo="c@sobanderia.test", nombre="Carlos", clave_hash="x", rol="sobandero"
        )
        sobandero = Sobandero(usuario=usuario, duracion_min=30)
        sesion.add(sobandero)
        sesion.flush()
        sesion.add(Horario(sobandero_id=sobandero.id, dia_semana=0, desde=time(8), hasta=time(18)))
        sesion.commit()
        return sobandero.id


def _agendar(sobandero_id: int, numero: int, inicio: str, barrera: threading.Barrier) -> int:
    cliente = TestClient(app)
    cuerpo = {
        "sobandero_id": sobandero_id,
        "inicio": inicio,
        "nombre": f"Cliente {numero}",
        "celular": f"30000000{numero:02d}",
        "consentimiento": True,
    }
    barrera.wait(timeout=30)
    return cliente.post("/publico/citas", json=cuerpo, headers=CSRF).status_code


def _lanzar(
    sobandero_id: int, inicios: list[str], celulares_distintos: bool = True
) -> Counter[int]:
    barrera = threading.Barrier(len(inicios))
    with ThreadPoolExecutor(max_workers=len(inicios)) as pool:
        futuros = [
            pool.submit(_agendar, sobandero_id, n if celulares_distintos else 0, inicio, barrera)
            for n, inicio in enumerate(inicios)
        ]
        return Counter(f.result(timeout=60) for f in futuros)


def test_veinte_hilos_a_la_misma_hora_solo_uno_gana(motor_real: Engine, sobandero_id: int) -> None:
    resultados = _lanzar(sobandero_id, [INICIO.isoformat()] * HILOS)

    assert resultados == {201: 1, 409: HILOS - 1}
    with Session(motor_real) as sesion:
        assert sesion.scalar(select(func.count()).select_from(Cita)) == 1
        assert (
            sesion.scalar(
                select(func.count())
                .select_from(Notificacion)
                .where(Notificacion.tipo == "confirmacion")
            )
            == 1
        )
        # Los 19 que perdieron no dejaron clientes a medias.
        assert sesion.scalar(select(func.count()).select_from(Cliente)) == 1


def test_mismo_celular_nuevo_en_horas_distintas_no_choca(
    motor_real: Engine, sobandero_id: int
) -> None:
    """Dos solicitudes del mismo celular nuevo a la vez no deben fallar por el cliente repetido."""
    from datetime import timedelta

    inicios = [(INICIO + timedelta(minutes=30 * n)).isoformat() for n in range(10)]
    resultados = _lanzar(sobandero_id, inicios, celulares_distintos=False)

    assert resultados == {201: 10}
    with Session(motor_real) as sesion:
        assert sesion.scalar(select(func.count()).select_from(Cliente)) == 1
        assert sesion.scalar(select(func.count()).select_from(Cita)) == 10

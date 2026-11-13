"""Bandeja de salida: envío, reintentos con espera creciente y dos workers sin duplicar.

Las pruebas de lógica usan la sesión con rollback; la de concurrencia confirma datos de verdad
porque `FOR UPDATE SKIP LOCKED` solo se ve con transacciones simultáneas.
"""

import threading
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import pytest
from sqlalchemy import Engine, create_engine, func, select, text
from sqlalchemy.orm import Session

from app.modelos import Cita, Cliente, Notificacion, Sobandero, Usuario
from app.servicios import bandeja
from app.whatsapp import ErrorPermanente, ErrorTemporal, Falso, Mensaje
from tests.conftest import (
    AHORA_PRUEBA,
    INICIO,
    URL_PRUEBAS,
    crear_cita,
    crear_cliente,
    crear_sobandero,
    rango,
)

VARIABLES = {"nombre": "Ana", "sobandero": "Luis", "dia": "lunes 7 de enero", "hora": "10:00 a. m."}


def _notificacion(
    sesion: Session,
    cita: Cita,
    plantilla: str = "cita_confirmada",
    tipo: str = "confirmacion",
    token: str | None = "tok-secreto",
    enviar_en: datetime = AHORA_PRUEBA,
) -> Notificacion:
    variables: dict[str, object] = dict(VARIABLES)
    if token:
        variables["token"] = token
    fila = Notificacion(
        cita_id=cita.id, tipo=tipo, plantilla=plantilla, variables=variables, enviar_en=enviar_en
    )
    sesion.add(fila)
    sesion.flush()
    return fila


@pytest.fixture
def cita(sesion: Session) -> Cita:
    return crear_cita(sesion, crear_sobandero(sesion, 1), crear_cliente(sesion))


class Roto:
    """Proveedor que falla con el error que se le indique."""

    def __init__(self, error: Exception) -> None:
        self.error = error
        self.llamadas = 0

    def enviar_plantilla(self, mensaje: Mensaje) -> str:
        self.llamadas += 1
        raise self.error

    def enviar_texto(self, celular: str, texto: str) -> str:
        raise self.error


def test_envia_y_marca_enviada_sin_dejar_el_token(sesion: Session, cita: Cita) -> None:
    fila = _notificacion(sesion, cita)
    proveedor = Falso()
    assert bandeja.procesar_siguiente(sesion, proveedor, AHORA_PRUEBA) is True
    sesion.refresh(fila)
    assert fila.estado == "enviada"
    assert fila.intentos == 1
    assert fila.id_externo == "falso-1"
    assert fila.enviada_en == AHORA_PRUEBA
    assert "token" not in fila.variables
    assert proveedor.enviados[0].codigo_enlace == "tok-secreto"
    assert proveedor.enviados[0].celular == "+573000000001"


def test_no_hace_nada_si_no_hay_pendientes(sesion: Session) -> None:
    assert bandeja.procesar_siguiente(sesion, Falso(), AHORA_PRUEBA) is False


def test_no_toma_las_que_aun_no_les_toca(sesion: Session, cita: Cita) -> None:
    fila = _notificacion(sesion, cita, enviar_en=AHORA_PRUEBA + timedelta(hours=1))
    proveedor = Falso()
    assert bandeja.procesar_siguiente(sesion, proveedor, AHORA_PRUEBA) is False
    assert proveedor.enviados == []
    assert fila.estado == "pendiente"


def test_envia_en_orden_de_enviar_en(sesion: Session, cita: Cita) -> None:
    tarde = _notificacion(sesion, cita, enviar_en=AHORA_PRUEBA - timedelta(minutes=1))
    pronto = _notificacion(sesion, cita, enviar_en=AHORA_PRUEBA - timedelta(minutes=9))
    bandeja.procesar_siguiente(sesion, Falso(), AHORA_PRUEBA)
    sesion.refresh(pronto)
    sesion.refresh(tarde)
    assert (pronto.estado, tarde.estado) == ("enviada", "pendiente")


def test_error_temporal_reintenta_con_espera_creciente(sesion: Session, cita: Cita) -> None:
    fila = _notificacion(sesion, cita)
    proveedor = Roto(ErrorTemporal("Meta respondió 503"))
    esperas: list[timedelta] = []
    ahora = AHORA_PRUEBA
    for _ in range(3):
        assert bandeja.procesar_siguiente(sesion, proveedor, ahora) is True
        sesion.refresh(fila)
        assert fila.estado == "pendiente"
        esperas.append(fila.enviar_en - ahora)
        ahora = fila.enviar_en
    assert esperas == [timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=30)]
    assert fila.intentos == 3
    assert fila.ultimo_error == "Meta respondió 503"
    assert fila.variables["token"] == "tok-secreto"  # sigue pendiente: aún hace falta


def test_al_cuarto_intento_queda_fallida_y_sin_token(sesion: Session, cita: Cita) -> None:
    fila = _notificacion(sesion, cita)
    proveedor = Roto(ErrorTemporal("Meta respondió 503"))
    ahora = AHORA_PRUEBA
    for _ in range(4):
        assert bandeja.procesar_siguiente(sesion, proveedor, ahora) is True
        sesion.refresh(fila)
        ahora = fila.enviar_en
    assert proveedor.llamadas == 4
    assert fila.estado == "fallida"
    assert fila.intentos == 4
    assert "token" not in fila.variables
    assert bandeja.procesar_siguiente(sesion, proveedor, ahora) is False
    assert proveedor.llamadas == 4


def test_error_permanente_falla_de_inmediato(sesion: Session, cita: Cita) -> None:
    fila = _notificacion(sesion, cita)
    proveedor = Roto(ErrorPermanente("Meta rechazó el mensaje (http 400, código 131026)"))
    bandeja.procesar_siguiente(sesion, proveedor, AHORA_PRUEBA)
    sesion.refresh(fila)
    assert fila.estado == "fallida"
    assert fila.intentos == 1
    assert "131026" in (fila.ultimo_error or "")
    assert "token" not in fila.variables


def test_mensaje_mal_armado_es_fallida_sin_llamar_al_proveedor(sesion: Session, cita: Cita) -> None:
    fila = _notificacion(sesion, cita, token=None)  # cita_confirmada sin código de enlace
    proveedor = Falso()
    bandeja.procesar_siguiente(sesion, proveedor, AHORA_PRUEBA)
    sesion.refresh(fila)
    assert fila.estado == "fallida"
    assert proveedor.enviados == []


@pytest.mark.parametrize(
    ("estado", "tipo"), [("cancelada", "confirmacion"), ("atendida", "recordatorio")]
)
def test_si_la_cita_ya_no_esta_agendada_no_se_envia(
    sesion: Session, cita: Cita, estado: str, tipo: str
) -> None:
    cita.estado = estado
    fila = _notificacion(sesion, cita, "recordatorio_cita", tipo, token=None)
    proveedor = Falso()
    bandeja.procesar_siguiente(sesion, proveedor, AHORA_PRUEBA)
    sesion.refresh(fila)
    assert fila.estado == "cancelada"
    assert proveedor.enviados == []


def test_el_aviso_de_cancelacion_si_sale_aunque_la_cita_este_cancelada(
    sesion: Session, cita: Cita
) -> None:
    cita.estado = "cancelada"
    fila = _notificacion(sesion, cita, "cita_cancelada", "cancelacion", token=None)
    bandeja.procesar_siguiente(sesion, Falso(), AHORA_PRUEBA)
    sesion.refresh(fila)
    assert fila.estado == "enviada"


def test_recordatorio_lleva_la_referencia_en_los_botones(sesion: Session, cita: Cita) -> None:
    fila = _notificacion(sesion, cita, "recordatorio_cita", "recordatorio", token=None)
    proveedor = Falso()
    bandeja.procesar_siguiente(sesion, proveedor, AHORA_PRUEBA)
    assert proveedor.enviados[0].payloads == (f"asistire:{fila.id}", f"cambiar:{fila.id}")


def test_vaciar_envia_todo_lo_vencido(sesion: Session, cita: Cita) -> None:
    for _ in range(3):
        _notificacion(sesion, cita, "cita_cancelada", "cancelacion", token=None)
    proveedor = Falso()
    assert bandeja.vaciar(sesion, proveedor, AHORA_PRUEBA) == 3
    assert len(proveedor.enviados) == 3


# --- Dos workers a la vez -------------------------------------------------------------------

TABLAS = "notificaciones, enlaces_cita, citas, clientes, bloqueos, horarios, sobanderos, usuarios"


class Lento(Falso):
    """Tarda un poco en enviar para que los workers se pisen si la bandeja no los separa."""

    def __init__(self) -> None:
        super().__init__()
        self.cerrojo = threading.Lock()

    def enviar_plantilla(self, mensaje: Mensaje) -> str:
        threading.Event().wait(0.01)
        with self.cerrojo:
            return super().enviar_plantilla(mensaje)


@pytest.fixture
def motor_real(motor: Engine) -> Iterator[Engine]:
    engine = create_engine(URL_PRUEBAS, pool_size=10, connect_args={"options": "-c timezone=UTC"})
    with engine.begin() as conexion:
        conexion.execute(text(f"TRUNCATE {TABLAS} RESTART IDENTITY CASCADE"))
    try:
        yield engine
    finally:
        with engine.begin() as conexion:
            conexion.execute(text(f"TRUNCATE {TABLAS} RESTART IDENTITY CASCADE"))
        engine.dispose()


def test_dos_workers_no_duplican_envios(motor_real: Engine) -> None:
    total = 60
    with Session(motor_real) as sesion:
        usuario = Usuario(correo="c@sobanderia.test", nombre="C", clave_hash="x", rol="sobandero")
        sobandero = Sobandero(usuario=usuario)
        cliente = Cliente(nombre="Ana", celular="+573001234567")
        sesion.add_all([sobandero, cliente])
        sesion.flush()
        cita = Cita(
            sobandero_id=sobandero.id,
            cliente_id=cliente.id,
            rango=rango(INICIO),
            origen="cliente",
        )
        sesion.add(cita)
        sesion.flush()
        sesion.add_all(
            Notificacion(
                cita_id=cita.id,
                tipo="cancelacion",
                plantilla="cita_cancelada",
                variables=dict(VARIABLES),
                enviar_en=AHORA_PRUEBA,
            )
            for _ in range(total)
        )
        sesion.commit()

    proveedor = Lento()

    def worker() -> int:
        with Session(motor_real) as propia:
            return bandeja.vaciar(propia, proveedor, AHORA_PRUEBA)

    with ThreadPoolExecutor(max_workers=2) as pool:
        resultados = list(pool.map(lambda _: worker(), range(2)))

    assert sum(resultados) == total
    with Session(motor_real) as sesion:
        enviadas = sesion.scalar(
            select(func.count()).select_from(Notificacion).where(Notificacion.estado == "enviada")
        )
        distintos = sesion.scalar(select(func.count(func.distinct(Notificacion.id_externo))))
    assert enviadas == total
    assert distintos == total
    assert len(proveedor.enviados) == total  # nadie salió dos veces

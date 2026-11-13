"""Horas libres = horario menos bloqueos menos citas activas, cortado cada `duracion_min`."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.modelos import Bloqueo
from app.servicios.horas import dias_con_horas, horas_libres
from tests.conftest import (
    AHORA_PRUEBA,
    INICIO,
    crear_cita,
    crear_cliente,
    crear_sobandero,
    dar_horario,
    rango,
    sobandero_con_horario,
)

BOGOTA = ZoneInfo("America/Bogota")
LUNES = date(2030, 1, 7)


def locales(horas: list[datetime]) -> list[str]:
    return [h.astimezone(BOGOTA).strftime("%H:%M") for h in horas]


def test_franja_partida_corta_cada_duracion(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    libres = locales(horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA))
    assert libres[:2] == ["08:00", "08:30"]
    assert "11:30" in libres and "12:00" not in libres  # la franja termina a las 12:00
    assert "12:30" not in libres and "13:30" not in libres  # almuerzo
    assert libres[-1] == "17:30"
    assert len(libres) == 16


def test_las_horas_salen_en_utc(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    primera = horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA)[0]
    assert primera.utcoffset() == timedelta(0)
    assert primera == datetime(2030, 1, 7, 13, 0, tzinfo=UTC)  # 8:00 en Bogotá


def test_duracion_distinta_cambia_los_cortes(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion, duracion=45)
    libres = locales(horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA))
    assert libres[:4] == ["08:00", "08:45", "09:30", "10:15"]
    assert "11:15" not in libres  # 11:15 + 45 pasaría de las 12:00


def test_bloqueo_a_mitad_de_dia(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    sesion.add(Bloqueo(sobandero_id=sobandero.id, rango=rango(INICIO + timedelta(minutes=15), 60)))
    sesion.flush()  # bloquea 10:15 a 11:15
    libres = locales(horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA))
    assert "09:30" in libres
    assert "10:00" not in libres  # 10:00-10:30 se cruza con el bloqueo
    assert "10:30" not in libres and "11:00" not in libres
    assert "11:30" in libres


def test_cita_activa_ocupa_su_hora_y_cancelada_no(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    crear_cita(sesion, sobandero, crear_cliente(sesion, 1))
    crear_cita(
        sesion, sobandero, crear_cliente(sesion, 2), INICIO + timedelta(hours=1), 30, "cancelada"
    )
    libres = locales(horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA))
    assert "10:00" not in libres
    assert "11:00" in libres and "09:30" in libres and "10:30" in libres


def test_cita_atendida_y_no_asistio_tambien_ocupan(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    crear_cita(sesion, sobandero, crear_cliente(sesion, 1), estado="atendida")
    crear_cita(
        sesion,
        sobandero,
        crear_cliente(sesion, 2),
        INICIO + timedelta(minutes=30),
        estado="no_asistio",
    )
    libres = locales(horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA))
    assert "10:00" not in libres and "10:30" not in libres


def test_cita_de_otra_duracion_bloquea_lo_que_cruza(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion, duracion=30)
    crear_cita(sesion, sobandero, crear_cliente(sesion, 1), minutos=45)  # 10:00-10:45
    libres = locales(horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA))
    assert "10:00" not in libres and "10:30" not in libres and "11:00" in libres


def test_cambiar_duracion_no_toca_citas_ya_creadas(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion, duracion=30)
    crear_cita(sesion, sobandero, crear_cliente(sesion, 1), minutos=30)
    sobandero.duracion_min = 60
    sesion.flush()
    libres = locales(horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA))
    assert "10:00" not in libres and "09:00" in libres  # 09:00-10:00 no choca con la cita


def test_dia_sin_horario_no_tiene_horas(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    assert horas_libres(sesion, sobandero, date(2030, 1, 12), AHORA_PRUEBA) == []  # sábado


def test_sobandero_sin_horario(sesion: Session) -> None:
    assert horas_libres(sesion, crear_sobandero(sesion, 5), LUNES, AHORA_PRUEBA) == []


def test_horas_pasadas_y_antelacion_minima(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    ahora = datetime(2030, 1, 7, 15, 10, tzinfo=UTC)  # 10:10 en Bogotá
    libres = locales(horas_libres(sesion, sobandero, LUNES, ahora, antelacion_min=60))
    assert libres[0] == "11:30"  # antes de 11:10 no, y 11:00 ya no alcanza
    assert horas_libres(sesion, sobandero, date(2030, 1, 4), ahora) == []


def test_sobandero_que_no_recibe_citas_no_tiene_horas(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    sobandero.recibe_citas = False
    sesion.flush()
    assert horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA) == []


def test_excluir_cita_permite_moverse_sobre_su_propia_hora(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    cita = crear_cita(sesion, sobandero, crear_cliente(sesion, 1))
    libres = horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA, excluir_cita_id=cita.id)
    assert INICIO in libres


def test_dia_de_bogota_no_se_corre_por_utc(sesion: Session) -> None:
    """Una franja de 18:00 en Bogotá (23:00 UTC) pertenece al lunes, no al martes."""
    sobandero = crear_sobandero(sesion, 6)
    dar_horario(sesion, sobandero, 0, time(17), time(19))
    assert locales(horas_libres(sesion, sobandero, LUNES, AHORA_PRUEBA)) == [
        "17:00",
        "17:30",
        "18:00",
        "18:30",
    ]
    assert horas_libres(sesion, sobandero, date(2030, 1, 8), AHORA_PRUEBA) == []


def test_dias_con_horas_omite_dias_llenos_o_sin_horario(sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion)
    dias = dias_con_horas(sesion, sobandero, AHORA_PRUEBA, dias=8)
    assert date(2030, 1, 5) not in dias and date(2030, 1, 6) not in dias  # sáb y dom
    assert dias[0] == date(2030, 1, 1)  # hoy, todavía quedan horas
    assert date(2030, 1, 7) in dias

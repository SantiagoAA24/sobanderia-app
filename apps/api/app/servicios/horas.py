"""Horas libres de un sobandero. El servidor las calcula; el frontend solo las muestra.

Horas libres de un día = franjas del horario semanal, menos bloqueos, menos citas activas,
cortadas cada `duracion_min` y sin horas pasadas. Todo se compara en UTC; el día y las franjas
se interpretan en la zona del negocio (Bogotá).
"""

from collections.abc import Sequence
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import Bloqueo, Cita, Horario, Sobandero

ZONA = ZoneInfo(ajustes.tz_negocio)

Intervalo = tuple[datetime, datetime]


def a_utc(dia: date, hora: time) -> datetime:
    """Una hora de pared de Bogotá, en UTC."""
    return datetime.combine(dia, hora, tzinfo=ZONA).astimezone(UTC)


def dia_local(momento: datetime) -> date:
    return momento.astimezone(ZONA).date()


def _ocupados(
    db: Session, sobandero_id: int, desde: datetime, hasta: datetime, excluir_cita_id: int | None
) -> list[Intervalo]:
    ventana = Cita.rango.overlaps(_rango(desde, hasta))
    citas = select(Cita.rango).where(
        Cita.sobandero_id == sobandero_id, Cita.estado != "cancelada", ventana
    )
    if excluir_cita_id is not None:
        citas = citas.where(Cita.id != excluir_cita_id)
    bloqueos = select(Bloqueo.rango).where(
        Bloqueo.sobandero_id == sobandero_id, Bloqueo.rango.overlaps(_rango(desde, hasta))
    )
    return [(r.lower, r.upper) for r in [*db.scalars(citas), *db.scalars(bloqueos)]]


def _rango(desde: datetime, hasta: datetime) -> Range[datetime]:
    return Range(desde, hasta, bounds="[)")


def _cortar(
    franjas: Sequence[Horario],
    dia: date,
    duracion: timedelta,
    ocupados: Sequence[Intervalo],
    minimo: datetime,
) -> list[datetime]:
    libres: list[datetime] = []
    for franja in franjas:
        fin_franja = a_utc(dia, franja.hasta)
        inicio = a_utc(dia, franja.desde)
        while inicio + duracion <= fin_franja:
            fin = inicio + duracion
            if inicio >= minimo and not any(o < fin and inicio < c for o, c in ocupados):
                libres.append(inicio)
            inicio = fin
    return libres


def _calcular(
    db: Session,
    sobandero: Sobandero,
    dias: Sequence[date],
    ahora: datetime,
    antelacion_min: int,
    excluir_cita_id: int | None,
) -> dict[date, list[datetime]]:
    """Calcula varios días con tres consultas en total."""
    if not dias or not sobandero.recibe_citas or not sobandero.usuario.activo:
        return {dia: [] for dia in dias}
    franjas_por_dia: dict[int, list[Horario]] = {}
    for franja in db.scalars(
        select(Horario)
        .where(Horario.sobandero_id == sobandero.id)
        .order_by(Horario.dia_semana, Horario.desde)
    ):
        franjas_por_dia.setdefault(franja.dia_semana, []).append(franja)
    ocupados = _ocupados(
        db,
        sobandero.id,
        a_utc(min(dias), time(0)),
        a_utc(max(dias) + timedelta(days=1), time(0)),
        excluir_cita_id,
    )
    minimo = ahora + timedelta(minutes=antelacion_min)
    duracion = timedelta(minutes=sobandero.duracion_min)
    return {
        dia: _cortar(franjas_por_dia.get(dia.weekday(), []), dia, duracion, ocupados, minimo)
        for dia in dias
    }


def horas_libres(
    db: Session,
    sobandero: Sobandero,
    dia: date,
    ahora: datetime,
    antelacion_min: int = 0,
    excluir_cita_id: int | None = None,
) -> list[datetime]:
    """Inicios libres (UTC) del día de Bogotá `dia`, en orden."""
    return _calcular(db, sobandero, [dia], ahora, antelacion_min, excluir_cita_id)[dia]


def dias_con_horas(
    db: Session,
    sobandero: Sobandero,
    ahora: datetime,
    dias: int | None = None,
    antelacion_min: int = 0,
) -> list[date]:
    """Días (desde hoy en Bogotá) que todavía tienen al menos una hora libre."""
    hoy = dia_local(ahora)
    lista = [hoy + timedelta(days=n) for n in range(dias or ajustes.dias_agenda)]
    por_dia = _calcular(db, sobandero, lista, ahora, antelacion_min, None)
    return [dia for dia in lista if por_dia[dia]]


def alternativas(
    db: Session,
    sobandero: Sobandero,
    pedida: datetime,
    ahora: datetime,
    cuantas: int = 3,
    excluir_cita_id: int | None = None,
) -> list[datetime]:
    """Las horas libres más cercanas a la pedida (hasta `cuantas`), en orden cronológico."""
    hoy = dia_local(ahora)
    lista = [hoy + timedelta(days=n) for n in range(ajustes.dias_agenda)]
    por_dia = _calcular(db, sobandero, lista, ahora, ajustes.antelacion_min, excluir_cita_id)
    todas = [h for horas in por_dia.values() for h in horas if h != pedida]
    cercanas = sorted(todas, key=lambda h: (abs(h - pedida), h))[:cuantas]
    return sorted(cercanas)


def proximo_cupo(
    db: Session, sobandero: Sobandero, ahora: datetime, antelacion_min: int = 0
) -> datetime | None:
    """La primera hora libre (UTC) dentro de la ventana de agenda, o None si no hay ninguna."""
    hoy = dia_local(ahora)
    lista = [hoy + timedelta(days=n) for n in range(ajustes.dias_agenda)]
    por_dia = _calcular(db, sobandero, lista, ahora, antelacion_min, None)
    return next((por_dia[dia][0] for dia in lista if por_dia[dia]), None)

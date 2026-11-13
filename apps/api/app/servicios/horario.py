"""Horario semanal y bloqueos del sobandero.

Cambiar el horario o bloquear horas nunca cancela citas ya agendadas: el sobandero las ve y decide.
"""

from datetime import datetime, time

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.orm import Session

from app.errores import ErrorApi
from app.modelos import Bloqueo, Cita, Horario, Sobandero

MAX_FRANJAS_POR_DIA = 4

Franja = tuple[time, time]


def horario_semanal(db: Session, sobandero: Sobandero) -> dict[int, list[Franja]]:
    """Franjas de cada día (0 = lunes ... 6 = domingo); los días sin atención van vacíos."""
    dias: dict[int, list[Franja]] = {d: [] for d in range(7)}
    filas = db.scalars(
        select(Horario)
        .where(Horario.sobandero_id == sobandero.id)
        .order_by(Horario.dia_semana, Horario.desde)
    )
    for fila in filas:
        dias[fila.dia_semana].append((fila.desde, fila.hasta))
    return dias


def validar_franjas(franjas: list[Franja]) -> list[Franja]:
    if len(franjas) > MAX_FRANJAS_POR_DIA:
        raise ErrorApi(422, "validacion", f"Máximo {MAX_FRANJAS_POR_DIA} franjas por día.")
    ordenadas = sorted(franjas)
    for desde, hasta in ordenadas:
        if desde >= hasta:
            raise ErrorApi(422, "validacion", "Cada franja debe terminar después de empezar.")
    for (_, fin), (inicio, _) in zip(ordenadas, ordenadas[1:], strict=False):
        if inicio < fin:
            raise ErrorApi(422, "validacion", "Las franjas de un mismo día no pueden cruzarse.")
    return ordenadas


def guardar_horario(
    db: Session, sobandero: Sobandero, dias: dict[int, list[Franja]]
) -> dict[int, list[Franja]]:
    """Reemplaza los días indicados; los demás quedan como estaban."""
    validados = {dia: validar_franjas(franjas) for dia, franjas in dias.items()}
    db.execute(
        delete(Horario).where(
            Horario.sobandero_id == sobandero.id, Horario.dia_semana.in_(list(validados))
        )
    )
    db.flush()
    for dia, franjas in validados.items():
        for desde, hasta in franjas:
            db.add(Horario(sobandero_id=sobandero.id, dia_semana=dia, desde=desde, hasta=hasta))
    db.commit()
    return horario_semanal(db, sobandero)


def citas_en_rango(db: Session, sobandero_id: int, inicio: datetime, fin: datetime) -> int:
    """Citas agendadas que se cruzan con el rango (las que un bloqueo no cancela)."""
    ventana = Range(inicio, fin, bounds="[)")
    return (
        db.scalar(
            select(func.count(Cita.id)).where(
                Cita.sobandero_id == sobandero_id,
                Cita.estado == "agendada",
                Cita.rango.overlaps(ventana),
            )
        )
        or 0
    )


def crear_bloqueo(
    db: Session,
    sobandero: Sobandero,
    inicio: datetime,
    fin: datetime,
    motivo: str | None,
    ahora: datetime,
) -> Bloqueo:
    if fin <= inicio:
        raise ErrorApi(422, "validacion", "La hora final debe ser después de la inicial.")
    if fin <= ahora:
        raise ErrorApi(422, "validacion", "Ese rango ya pasó. Elija una hora que no haya pasado.")
    bloqueo = Bloqueo(
        sobandero_id=sobandero.id,
        rango=Range(inicio, fin, bounds="[)"),
        motivo=(motivo or "").strip() or None,
    )
    db.add(bloqueo)
    db.commit()
    return bloqueo


def bloqueos_vigentes(db: Session, sobandero: Sobandero, ahora: datetime) -> list[Bloqueo]:
    """Los que todavía no terminaron, en orden cronológico."""
    return list(
        db.scalars(
            select(Bloqueo)
            .where(
                Bloqueo.sobandero_id == sobandero.id,
                Bloqueo.rango.overlaps(Range(ahora, None, bounds="[)")),
            )
            .order_by(Bloqueo.rango)
        )
    )

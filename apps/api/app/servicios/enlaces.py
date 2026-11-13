"""Enlace firmado de un solo uso por cita: el token viaja una vez y en la base queda su hash."""

from datetime import datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errores import enlace_vencido
from app.modelos import Cita, EnlaceCita
from app.seguridad.tokens import generar_token, hash_token
from app.servicios.horas import a_utc, dia_local


def vence_para(inicio: datetime) -> datetime:
    """Vale hasta el final del día siguiente a la cita (hora de Bogotá)."""
    return a_utc(dia_local(inicio) + timedelta(days=2), time(0))


def crear_enlace(db: Session, cita: Cita) -> str:
    token = generar_token()
    db.add(
        EnlaceCita(cita_id=cita.id, token_hash=hash_token(token), vence_en=vence_para(cita.inicio))
    )
    return token


def cita_por_token(db: Session, token: str, ahora: datetime) -> tuple[Cita, EnlaceCita]:
    """410 si el enlace no existe o venció (misma respuesta, para no revelar cuál)."""
    fila = db.execute(
        select(Cita, EnlaceCita)
        .join(EnlaceCita, EnlaceCita.cita_id == Cita.id)
        .where(EnlaceCita.token_hash == hash_token(token))
    ).first()
    if fila is None or fila[1].vence_en <= ahora:
        raise enlace_vencido()
    return fila[0], fila[1]


def mover_enlace(enlace: EnlaceCita, cita_nueva: Cita, rotar: bool) -> str | None:
    """Pasa el enlace a la cita nueva. Con `rotar` crea un token nuevo y lo devuelve."""
    enlace.cita_id = cita_nueva.id
    enlace.vence_en = vence_para(cita_nueva.inicio)
    if not rotar:
        return None
    token = generar_token()
    enlace.token_hash = hash_token(token)
    return token

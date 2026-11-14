"""Limpieza de filas que ya no sirven (H-09): sin esto, intentos, sesiones, enlaces y tokens
vencidos solo crecerían, sobre todo bajo abuso. La corre el worker cada hora."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import CursorResult, delete
from sqlalchemy.orm import Session

from app.config import ajustes
from app.modelos import EnlaceCita, IntentoIngreso, RecuperacionClave, Sesion


@dataclass(frozen=True)
class Purgadas:
    intentos: int
    sesiones: int
    recuperaciones: int
    enlaces: int

    @property
    def total(self) -> int:
        return self.intentos + self.sesiones + self.recuperaciones + self.enlaces


def _filas(resultado: Any) -> int:
    return int(resultado.rowcount) if isinstance(resultado, CursorResult) else 0


def purgar(db: Session, ahora: datetime) -> Purgadas:
    """Borra lo vencido. Un enlace o token vencido responde igual que uno que no existe (410),
    así que quitarlo no cambia lo que ve nadie. Los intentos se conservan más que la ventana
    más larga de los límites (un día)."""
    limite_intentos = ahora - timedelta(hours=ajustes.intentos_conservar_horas)
    resultado = Purgadas(
        intentos=_filas(
            db.execute(delete(IntentoIngreso).where(IntentoIngreso.momento < limite_intentos))
        ),
        sesiones=_filas(db.execute(delete(Sesion).where(Sesion.vence_en <= ahora))),
        recuperaciones=_filas(
            db.execute(delete(RecuperacionClave).where(RecuperacionClave.vence_en <= ahora))
        ),
        enlaces=_filas(db.execute(delete(EnlaceCita).where(EnlaceCita.vence_en <= ahora))),
    )
    db.commit()
    return resultado

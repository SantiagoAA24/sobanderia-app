"""Baja de un sobandero. La fila y su historial nunca se borran.

- «Cancelar y avisar»: se desactiva la cuenta y se cierran sus sesiones al instante.
- «Dejarlas como están»: deja de recibir citas nuevas, pero la cuenta sigue activa hasta que cierre
  la última cita agendada; entonces se desactiva sola (`revisar_baja`).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modelos import Cita, Sobandero
from app.servicios import auditoria
from app.servicios.auth import cerrar_sesiones


def desactivar(db: Session, sobandero: Sobandero) -> None:
    sobandero.recibe_citas = False
    sobandero.usuario.activo = False
    cerrar_sesiones(db, sobandero.usuario_id)


def revisar_baja(db: Session, sobandero_id: int) -> None:
    """Si ya no le queda ninguna cita agendada a quien está de baja, desactiva la cuenta.

    No cierra la transacción: se llama justo antes del `commit` del cambio de la cita.
    """
    sobandero = db.get(Sobandero, sobandero_id)
    if sobandero is None or sobandero.baja_en is None or not sobandero.usuario.activo:
        return
    pendiente = db.scalar(
        select(Cita.id).where(Cita.sobandero_id == sobandero_id, Cita.estado == "agendada").limit(1)
    )
    if pendiente is None:
        desactivar(db, sobandero)
        auditoria.registrar(
            db,
            None,
            "baja_completada",
            "sobandero",
            sobandero.id,
            {"sobandero": sobandero.usuario.nombre},
        )

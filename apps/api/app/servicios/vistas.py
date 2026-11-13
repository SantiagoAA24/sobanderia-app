"""Arma las salidas que comparten las rutas del cliente."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.modelos import Cita, Cliente, Sobandero
from app.rutas.esquemas import CitaClienteOut, SobanderoOut


def vista_cliente(db: Session, cita: Cita, ahora: datetime) -> CitaClienteOut:
    sobandero = db.get(Sobandero, cita.sobandero_id)
    cliente = db.get(Cliente, cita.cliente_id)
    assert sobandero is not None and cliente is not None
    minutos = int((cita.fin - cita.inicio).total_seconds() // 60)
    return CitaClienteOut(
        estado=cita.estado,
        inicio=cita.inicio,
        fin=cita.fin,
        duracion_min=minutos,
        sobandero=SobanderoOut(
            id=sobandero.id, nombre=sobandero.usuario.nombre, duracion_min=sobandero.duracion_min
        ),
        cliente_nombre=cliente.nombre,
        puede_modificar=cita.estado == "agendada" and cita.inicio > ahora,
    )

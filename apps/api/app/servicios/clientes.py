"""Clientes de un sobandero: solo los que han tenido citas con él."""

import re
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.errores import no_encontrado
from app.modelos import Cita, Cliente

LIMITE = 200


@dataclass
class ResumenCliente:
    cliente: Cliente
    ultima_cita: datetime | None
    total: int


def _escapar(texto: str) -> str:
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def listar(db: Session, sobandero_id: int, ahora: datetime, q: str = "") -> list[ResumenCliente]:
    inicio = func.lower(Cita.rango)
    activa = Cita.estado != "cancelada"
    ultima = func.max(inicio).filter(and_(activa, inicio <= ahora))
    consulta = (
        select(Cliente, ultima, func.count(Cita.id).filter(activa))
        .join(Cita, Cita.cliente_id == Cliente.id)
        .where(Cita.sobandero_id == sobandero_id)
        .group_by(Cliente.id)
        .order_by(ultima.desc().nulls_last(), Cliente.nombre)
        .limit(LIMITE)
    )
    q = q.strip()
    if q:
        digitos = re.sub(r"\D", "", q)
        condiciones = [Cliente.nombre.ilike(f"%{_escapar(q)}%", escape="\\")]
        if len(digitos) >= 3:
            condiciones.append(Cliente.celular.like(f"%{digitos}%"))
        consulta = consulta.where(or_(*condiciones))
    return [ResumenCliente(c, u, t) for c, u, t in db.execute(consulta)]


def citas_con(db: Session, sobandero_id: int, cliente_id: int) -> tuple[Cliente, list[Cita]]:
    """Citas del cliente con este sobandero; sin ninguna, responde como si no existiera."""
    citas = list(
        db.scalars(
            select(Cita)
            .where(Cita.sobandero_id == sobandero_id, Cita.cliente_id == cliente_id)
            .order_by(Cita.rango)
        )
    )
    cliente = db.get(Cliente, cliente_id) if citas else None
    if cliente is None:
        raise no_encontrado("No encontramos a ese cliente.")
    return cliente, citas

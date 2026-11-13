"""Clientes de quien ingresó: lista con búsqueda y ficha con su historial."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import obtener_sesion
from app.modelos import Sobandero
from app.reloj import Ahora
from app.rutas.esquemas import NO_ENCONTRADO, SESION
from app.rutas.yo_citas import CitaSobanderoOut, ClienteOut, salida_cita
from app.seguridad.dependencias import sobandero_actual
from app.servicios import clientes as servicio

router = APIRouter(prefix="/yo/clientes", tags=["sobandero"])
Db = Annotated[Session, Depends(obtener_sesion)]
Yo = Annotated[Sobandero, Depends(sobandero_actual)]


class ClienteListaOut(ClienteOut):
    """`ultima_cita` es la última que ya empezó y no se canceló; nula si no tiene."""

    ultima_cita: datetime | None
    total: int


class FichaClienteOut(ClienteOut):
    cliente_desde: datetime
    total: int
    proximas: list[CitaSobanderoOut]
    historial: list[CitaSobanderoOut]


@router.get("", responses=SESION)
def listar(db: Db, yo: Yo, ahora: Ahora, q: str = "") -> list[ClienteListaOut]:
    """Solo los clientes que han tenido citas con este sobandero. `q` busca por nombre o celular."""
    return [
        ClienteListaOut(
            id=r.cliente.id,
            nombre=r.cliente.nombre,
            celular=r.cliente.celular,
            ultima_cita=r.ultima_cita,
            total=r.total,
        )
        for r in servicio.listar(db, yo.id, ahora, q[:60])
    ]


@router.get("/{cliente_id}", responses=SESION | NO_ENCONTRADO)
def ficha(cliente_id: int, db: Db, yo: Yo, ahora: Ahora) -> FichaClienteOut:
    """Próximas citas e historial de este cliente con este sobandero, nunca con otros."""
    cliente, citas = servicio.citas_con(db, yo.id, cliente_id)
    futuras = [c for c in citas if c.estado == "agendada" and c.inicio > ahora]
    pasadas = [c for c in citas if c not in futuras]
    return FichaClienteOut(
        id=cliente.id,
        nombre=cliente.nombre,
        celular=cliente.celular,
        cliente_desde=cliente.creado_en,
        total=sum(1 for c in citas if c.estado != "cancelada"),
        proximas=[salida_cita(c, cliente, ahora) for c in futuras],
        historial=[salida_cita(c, cliente, ahora) for c in reversed(pasadas)],
    )

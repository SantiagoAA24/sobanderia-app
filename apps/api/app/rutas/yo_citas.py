from datetime import date, datetime, time, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import AwareDatetime, BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.orm import Session

from app.db import obtener_sesion
from app.errores import ErrorApi, no_encontrado
from app.modelos import Cita, Cliente, Sobandero
from app.reloj import Ahora
from app.rutas.esquemas import (
    ERRORES_AGENDA,
    NO_ENCONTRADO,
    SESION,
    Celular,
    ErrorOut,
    Nombre,
)
from app.seguridad.dependencias import sobandero_actual
from app.servicios import citas as servicio
from app.servicios.horas import a_utc, dia_local

router = APIRouter(prefix="/yo/citas", tags=["sobandero"])
Db = Annotated[Session, Depends(obtener_sesion)]
Yo = Annotated[Sobandero, Depends(sobandero_actual)]


class ClienteOut(BaseModel):
    id: int
    nombre: str
    celular: str


class CitaSobanderoOut(BaseModel):
    id: int
    estado: str
    origen: str
    inicio: datetime
    fin: datetime
    cliente: ClienteOut
    puede_modificar: bool


class NuevaCitaIn(BaseModel):
    nombre: Nombre
    celular: Celular
    inicio: AwareDatetime


class CambioCitaIn(BaseModel):
    """Una de dos: `estado` (atendida, no_asistio o cancelada) o `inicio` (cambiar la hora)."""

    estado: Literal["atendida", "no_asistio", "cancelada"] | None = None
    inicio: AwareDatetime | None = None
    avisar: bool = True


def salida_cita(cita: Cita, cliente: Cliente, ahora: datetime) -> CitaSobanderoOut:
    return CitaSobanderoOut(
        id=cita.id,
        estado=cita.estado,
        origen=cita.origen,
        inicio=cita.inicio,
        fin=cita.fin,
        cliente=ClienteOut(id=cliente.id, nombre=cliente.nombre, celular=cliente.celular),
        puede_modificar=cita.estado == "agendada" and cita.inicio > ahora,
    )


def _propia(db: Session, yo: Sobandero, cita_id: int) -> Cita:
    """La cita de otro sobandero responde igual que una que no existe."""
    cita = db.scalar(select(Cita).where(Cita.id == cita_id, Cita.sobandero_id == yo.id))
    if cita is None:
        raise no_encontrado("No encontramos esa cita.")
    return cita


@router.get("", responses=SESION | {422: {"model": ErrorOut}})
def listar(
    db: Db,
    yo: Yo,
    ahora: Ahora,
    dia: date | None = None,
    semana: date | None = None,
    incluir_canceladas: bool = False,
) -> list[CitaSobanderoOut]:
    """Hoy (`dia=`) o Semana (`semana=` con cualquier fecha de esa semana, de lunes a domingo)."""
    if dia is not None and semana is not None:
        raise ErrorApi(422, "validacion", "Elija un día o una semana, no ambos.")
    if semana is not None:
        desde = semana - timedelta(days=semana.weekday())
        hasta = desde + timedelta(days=7)
    else:
        desde = dia or dia_local(ahora)
        hasta = desde + timedelta(days=1)
    ventana = Range(a_utc(desde, time(0)), a_utc(hasta, time(0)), bounds="[)")
    consulta = (
        select(Cita, Cliente)
        .join(Cliente, Cliente.id == Cita.cliente_id)
        .where(Cita.sobandero_id == yo.id, Cita.rango.overlaps(ventana))
        .order_by(Cita.rango)
    )
    if not incluir_canceladas:
        consulta = consulta.where(Cita.estado != "cancelada")
    return [salida_cita(c, cl, ahora) for c, cl in db.execute(consulta)]


@router.get("/{cita_id}", responses=SESION | NO_ENCONTRADO)
def detalle(cita_id: int, db: Db, yo: Yo, ahora: Ahora) -> CitaSobanderoOut:
    cita = _propia(db, yo, cita_id)
    cliente = db.get(Cliente, cita.cliente_id)
    assert cliente is not None
    return salida_cita(cita, cliente, ahora)


@router.post("", status_code=201, responses=SESION | ERRORES_AGENDA)
def crear(datos: NuevaCitaIn, db: Db, yo: Yo, ahora: Ahora) -> CitaSobanderoOut:
    cita, cliente, _ = servicio.crear_cita(
        db, yo, datos.nombre, datos.celular, datos.inicio, ahora, origen="sobandero"
    )
    return salida_cita(cita, cliente, ahora)


@router.patch("/{cita_id}", responses=SESION | ERRORES_AGENDA | NO_ENCONTRADO)
def cambiar(cita_id: int, datos: CambioCitaIn, db: Db, yo: Yo, ahora: Ahora) -> CitaSobanderoOut:
    """Marca atendida o no asistió, cancela o cambia la hora (devuelve la cita resultante)."""
    if (datos.estado is None) == (datos.inicio is None):
        raise ErrorApi(422, "validacion", "Indique el estado o la hora nueva, no ambos.")
    cita = _propia(db, yo, cita_id)
    if datos.inicio is not None:
        cita, _ = servicio.reprogramar(
            db, cita, datos.inicio, ahora, por="sobandero", avisar=datos.avisar
        )
    elif datos.estado == "cancelada":
        servicio.cancelar(db, cita, ahora, por="sobandero", avisar=datos.avisar)
    else:
        assert datos.estado is not None
        servicio.cerrar(db, cita, datos.estado)
    cliente = db.get(Cliente, cita.cliente_id)
    assert cliente is not None
    return salida_cita(cita, cliente, ahora)

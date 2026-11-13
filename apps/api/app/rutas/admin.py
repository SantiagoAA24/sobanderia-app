"""Zona del administrador. Cada ruta exige el rol `admin` en el servidor."""

from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session

from app.correo import EnviadorCorreo, obtener_enviador
from app.db import obtener_sesion
from app.modelos import Usuario
from app.reloj import Ahora
from app.rutas.esquemas import (
    NO_ENCONTRADO,
    SESION,
    CorreoTexto,
    ErrorOut,
    NegocioOut,
    Nombre,
    Respuestas,
)
from app.rutas.yo_agenda import HorarioIn, HorarioOut, dias_de_entrada, horario_out
from app.seguridad.dependencias import requiere_admin
from app.servicios import admin as servicio
from app.servicios import auditoria
from app.servicios import horario as servicio_horario

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(requiere_admin)],
    responses=SESION,
)
Db = Annotated[Session, Depends(obtener_sesion)]
Admin = Annotated[Usuario, Depends(requiere_admin)]
Correo = Annotated[EnviadorCorreo, Depends(obtener_enviador)]
Invalido: Respuestas = {422: {"model": ErrorOut, "description": "`validacion`"}}
CorreoEnUso: Respuestas = {409: {"model": ErrorOut, "description": "`correo_en_uso`"}}

YaDadoDeBaja: Respuestas = {409: {"model": ErrorOut, "description": "`ya_dado_de_baja`"}}

Duracion = Literal[20, 30, 45, 60]
Texto = Annotated[str, StringConstraints(strip_whitespace=True)]


# --- Formas -----------------------------------------------------------------------------------


class SobanderoAdminOut(BaseModel):
    id: int
    nombre: str
    correo: str
    activo: bool
    recibe_citas: bool
    duracion_min: int
    baja_en: datetime | None
    dias: list[int]
    citas_proximas: int


class NuevoSobanderoIn(BaseModel):
    nombre: Nombre
    correo: CorreoTexto
    clave_temporal: str = Field(min_length=8, max_length=200)
    duracion_min: Duracion = 30


class CambioSobanderoIn(BaseModel):
    nombre: Nombre | None = None
    correo: CorreoTexto | None = None
    recibe_citas: bool | None = None
    duracion_min: Duracion | None = None


class BajaIn(BaseModel):
    citas: Literal["dejar", "cancelar"]


class BajaOut(BaseModel):
    sobandero: SobanderoAdminOut
    citas_canceladas: int


class FilaResumenOut(BaseModel):
    id: int
    nombre: str
    citas: int
    siguiente: datetime | None


class ResumenOut(BaseModel):
    dia: date
    citas_total: int
    sobanderos_atendiendo: int
    por_sobandero: list[FilaResumenOut]


class SobanderoCortoOut(BaseModel):
    id: int
    nombre: str


class CitaAgendaOut(BaseModel):
    id: int
    estado: str
    inicio: datetime
    fin: datetime
    cliente_nombre: str
    sobandero: SobanderoCortoOut


class NegocioIn(BaseModel):
    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    direccion: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
    ]
    telefono: Annotated[
        str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[0-9][0-9 ()\-]{5,28}$")
    ]
    mensaje_bienvenida: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)
    ]


class ActividadOut(BaseModel):
    id: int
    creado_en: datetime
    quien: str
    texto: str
    accion: str


def _salida(f: servicio.FichaSobandero) -> SobanderoAdminOut:
    s = f.sobandero
    return SobanderoAdminOut(
        id=s.id,
        nombre=s.usuario.nombre,
        correo=s.usuario.correo,
        activo=s.usuario.activo,
        recibe_citas=s.recibe_citas,
        duracion_min=s.duracion_min,
        baja_en=s.baja_en,
        dias=f.dias,
        citas_proximas=f.citas_proximas,
    )


# --- Resumen y agenda -------------------------------------------------------------------------


@router.get("/resumen")
def ver_resumen(db: Db, ahora: Ahora, dia: date | None = None) -> ResumenOut:
    """Total del día y una fila por sobandero activo."""
    dia = dia or servicio.dia_de_hoy(ahora)
    total, filas = servicio.resumen(db, dia, ahora)
    return ResumenOut(
        dia=dia,
        citas_total=total,
        sobanderos_atendiendo=sum(1 for f in filas if f.citas > 0),
        por_sobandero=[
            FilaResumenOut(
                id=f.sobandero.id,
                nombre=f.sobandero.usuario.nombre,
                citas=f.citas,
                siguiente=f.siguiente,
            )
            for f in filas
        ],
    )


@router.get("/agenda")
def ver_agenda(db: Db, ahora: Ahora, dia: date | None = None) -> list[CitaAgendaOut]:
    """Citas del día de todos los sobanderos, sin celulares y sin canceladas."""
    dia = dia or servicio.dia_de_hoy(ahora)
    return [
        CitaAgendaOut(
            id=c.id,
            estado=c.estado,
            inicio=c.inicio,
            fin=c.fin,
            cliente_nombre=cl.nombre,
            sobandero=SobanderoCortoOut(id=s.id, nombre=s.usuario.nombre),
        )
        for c, cl, s in servicio.agenda(db, dia)
    ]


# --- Sobanderos -------------------------------------------------------------------------------


@router.get("/sobanderos")
def listar_sobanderos(
    db: Db, ahora: Ahora, incluir_inactivos: bool = False
) -> list[SobanderoAdminOut]:
    return [_salida(f) for f in servicio.listar_sobanderos(db, ahora, incluir_inactivos)]


@router.post("/sobanderos", status_code=201, responses=Invalido | CorreoEnUso)
def crear_sobandero(
    datos: NuevoSobanderoIn, db: Db, admin: Admin, ahora: Ahora
) -> SobanderoAdminOut:
    """La clave temporal no vuelve a mostrarse; el sobandero la cambia en su primer ingreso."""
    sobandero = servicio.crear_sobandero(
        db, admin, datos.nombre, datos.correo, datos.clave_temporal, datos.duracion_min
    )
    return _salida(servicio.ficha(db, sobandero, ahora))


@router.get("/sobanderos/{sobandero_id}", responses=NO_ENCONTRADO)
def ver_sobandero(sobandero_id: int, db: Db, ahora: Ahora) -> SobanderoAdminOut:
    return _salida(servicio.ficha(db, servicio.obtener(db, sobandero_id), ahora))


@router.patch("/sobanderos/{sobandero_id}", responses=NO_ENCONTRADO | Invalido | CorreoEnUso)
def editar_sobandero(
    sobandero_id: int,
    datos: CambioSobanderoIn,
    db: Db,
    admin: Admin,
    enviador: Correo,
    ahora: Ahora,
) -> SobanderoAdminOut:
    """La duración nueva solo aplica a las citas nuevas; las agendadas no cambian."""
    sobandero = servicio.obtener(db, sobandero_id)
    cambios = datos.model_dump(exclude_none=True)
    servicio.editar_sobandero(db, enviador, admin, sobandero, cambios)
    return _salida(servicio.ficha(db, sobandero, ahora))


@router.get("/sobanderos/{sobandero_id}/horario", responses=NO_ENCONTRADO)
def ver_horario(sobandero_id: int, db: Db) -> HorarioOut:
    sobandero = servicio.obtener(db, sobandero_id)
    return horario_out(sobandero, servicio_horario.horario_semanal(db, sobandero))


@router.put("/sobanderos/{sobandero_id}/horario", responses=NO_ENCONTRADO | Invalido)
def guardar_horario(sobandero_id: int, datos: HorarioIn, db: Db, admin: Admin) -> HorarioOut:
    """Reemplaza las franjas de los días enviados. No toca las citas ya agendadas."""
    sobandero = servicio.obtener(db, sobandero_id)
    semana = servicio.guardar_horario(db, admin, sobandero, dias_de_entrada(datos))
    return horario_out(sobandero, semana)


@router.post("/sobanderos/{sobandero_id}/enlace-clave", status_code=204, responses=NO_ENCONTRADO)
def enlace_clave(sobandero_id: int, db: Db, admin: Admin, enviador: Correo) -> Response:
    """Envía al sobandero un enlace de un solo uso para crear una clave nueva."""
    servicio.enviar_enlace_clave(db, enviador, admin, servicio.obtener(db, sobandero_id))
    return Response(status_code=204)


@router.post(
    "/sobanderos/{sobandero_id}/baja",
    responses=NO_ENCONTRADO | Invalido | YaDadoDeBaja,
)
def dar_de_baja(sobandero_id: int, datos: BajaIn, db: Db, admin: Admin, ahora: Ahora) -> BajaOut:
    """`dejar`: sus citas próximas siguen y la cuenta se cierra al terminarlas.
    `cancelar`: se cancelan con aviso por WhatsApp y la cuenta se cierra al instante.
    El historial se conserva."""
    sobandero = servicio.obtener(db, sobandero_id)
    resultado = servicio.dar_de_baja(db, admin, sobandero, datos.citas, ahora)
    return BajaOut(
        sobandero=_salida(servicio.ficha(db, sobandero, ahora)),
        citas_canceladas=resultado.citas_canceladas,
    )


# --- Negocio y actividad ----------------------------------------------------------------------


@router.get("/negocio", responses=NO_ENCONTRADO)
def ver_negocio(db: Db) -> NegocioOut:
    n = servicio.ver_negocio(db)
    return NegocioOut(
        nombre=n.nombre,
        direccion=n.direccion,
        telefono=n.telefono,
        mensaje_bienvenida=n.mensaje_bienvenida,
    )


@router.put("/negocio", responses=Invalido)
def guardar_negocio(datos: NegocioIn, db: Db, admin: Admin) -> NegocioOut:
    n = servicio.guardar_negocio(
        db, admin, datos.nombre, datos.direccion, datos.telefono, datos.mensaje_bienvenida
    )
    return NegocioOut(
        nombre=n.nombre,
        direccion=n.direccion,
        telefono=n.telefono,
        mensaje_bienvenida=n.mensaje_bienvenida,
    )


@router.get("/actividad", responses=Invalido)
def actividad(
    db: Db,
    limite: Annotated[int, Query(ge=1, le=100)] = 50,
    antes: int | None = None,
) -> list[ActividadOut]:
    """Lo más reciente primero. Para ver más, pase `antes` con el id de la última fila vista."""
    return [
        ActividadOut(
            id=fila.id,
            creado_en=fila.creado_en,
            quien=nombre or "El sistema",
            texto=auditoria.texto(fila.accion, fila.detalle),
            accion=fila.accion,
        )
        for fila, nombre in auditoria.listar(db, limite, antes)
    ]

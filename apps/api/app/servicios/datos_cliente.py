"""Datos personales de un cliente (Ley 1581 de 2012): exportar lo que se guarda y anonimizar.

Anonimizar conserva las citas (el historial y las cifras del negocio no cambian) pero deja de
haber una persona identificable: el nombre y el celular se reemplazan, los mensajes de la bandeja
pierden el nombre y el token, los enlaces de la cita dejan de servir y se borran los intentos de
«Encontrar mi cita» guardados con el hash de su celular.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast

from sqlalchemy import CursorResult, delete, select, update
from sqlalchemy.orm import Session

from app.errores import ErrorApi, no_encontrado
from app.modelos import Cita, Cliente, EnlaceCita, IntentoIngreso, Notificacion, Sobandero, Usuario
from app.seguridad.celular import normalizar_celular
from app.seguridad.tokens import hash_token
from app.servicios import auditoria, citas

NOMBRE_ANONIMO = "Cliente anonimizado"


def _filas(resultado: Any) -> int:
    """Filas que tocó un UPDATE o DELETE."""
    return cast(CursorResult[Any], resultado).rowcount


def celular_anonimo(cliente_id: int) -> str:
    """Número inerte y único (el prefijo +999 no está asignado) que cumple el formato E.164."""
    return f"+999{cliente_id:09d}"


@dataclass(frozen=True)
class ResultadoAnonimizar:
    cliente_id: int
    citas_futuras_canceladas: int
    mensajes_limpiados: int
    enlaces_revocados: int
    intentos_borrados: int


def buscar_cliente(db: Session, celular: str) -> Cliente:
    """El celular se normaliza igual que al agendar; sin cliente responde 404."""
    try:
        numero = normalizar_celular(celular)
    except ErrorApi as error:
        raise ErrorApi(422, "validacion", "Revise el número de celular.") from error
    cliente = db.scalar(select(Cliente).where(Cliente.celular == numero))
    if cliente is None:
        raise no_encontrado("No hay un cliente con ese celular.")
    return cliente


def _citas_de(db: Session, cliente: Cliente) -> list[Cita]:
    return list(db.scalars(select(Cita).where(Cita.cliente_id == cliente.id).order_by(Cita.rango)))


def citas_futuras_agendadas(db: Session, cliente: Cliente, ahora: datetime) -> list[Cita]:
    return [c for c in _citas_de(db, cliente) if c.estado == "agendada" and c.inicio > ahora]


def exportar(db: Session, cliente: Cliente, ahora: datetime) -> dict[str, Any]:
    """Todo lo que se guarda de la persona, sin tokens. Se entrega a ella; no se registra."""
    lista = _citas_de(db, cliente)
    nombres = {
        s.id: nombre
        for s, nombre in db.execute(
            select(Sobandero, Usuario.nombre).join(Usuario, Usuario.id == Sobandero.usuario_id)
        )
    }
    mensajes: list[Notificacion] = []
    if lista:
        consulta = (
            select(Notificacion)
            .where(Notificacion.cita_id.in_([c.id for c in lista]))
            .order_by(Notificacion.id)
        )
        mensajes = list(db.scalars(consulta))
    auditoria.registrar(db, None, "cliente_exportado", "cliente", cliente.id, {"citas": len(lista)})
    db.commit()
    return {
        "generado_en": ahora.isoformat(),
        "cliente": {
            "nombre": cliente.nombre,
            "celular": cliente.celular,
            "registrado_en": cliente.creado_en.isoformat(),
            "politica_aceptada_en": (
                cliente.politica_aceptada_en.isoformat() if cliente.politica_aceptada_en else None
            ),
            "politica_version": cliente.politica_version,
        },
        "citas": [
            {
                "estado": c.estado,
                "origen": c.origen,
                "cancelada_por": c.cancelada_por,
                "inicio": c.inicio.isoformat(),
                "fin": c.fin.isoformat(),
                "sobandero": nombres.get(c.sobandero_id),
                "creada_en": c.creado_en.isoformat(),
            }
            for c in lista
        ],
        "mensajes": [
            {
                "plantilla": m.plantilla,
                "tipo": m.tipo,
                "estado": m.estado,
                "creado_en": m.creado_en.isoformat(),
                "enviada_en": m.enviada_en.isoformat() if m.enviada_en else None,
            }
            for m in mensajes
        ],
    }


def anonimizar(
    db: Session, cliente: Cliente, ahora: datetime, cancelar_futuras: bool = False
) -> ResultadoAnonimizar:
    """Con citas futuras agendadas se detiene, salvo que se pida cancelarlas (sin avisar:
    el aviso iría al número que se está borrando)."""
    futuras = citas_futuras_agendadas(db, cliente, ahora)
    if futuras and not cancelar_futuras:
        raise ErrorApi(
            409,
            "citas_futuras",
            f"Tiene {len(futuras)} cita(s) agendada(s) por venir. Cancélelas antes o use la "
            "opción para cancelarlas.",
        )
    for cita in futuras:
        citas.cancelar_sin_guardar(db, cita, ahora, por="admin", avisar=False)

    ids_citas = [c.id for c in _citas_de(db, cliente)]
    huella = hash_token(cliente.celular)  # así guarda «Encontrar mi cita» sus intentos
    limpiados = 0
    revocados = 0
    if ids_citas:
        # Se quitan el nombre y el token de los mensajes (los pendientes ya quedaron cancelados).
        limpiados = _filas(
            db.execute(
                update(Notificacion)
                .where(Notificacion.cita_id.in_(ids_citas))
                .values(variables=Notificacion.variables.op("-")("nombre").op("-")("token"))
            )
        )
        revocados = _filas(db.execute(delete(EnlaceCita).where(EnlaceCita.cita_id.in_(ids_citas))))
    borrados = _filas(db.execute(delete(IntentoIngreso).where(IntentoIngreso.correo == huella)))

    cliente.nombre = NOMBRE_ANONIMO
    cliente.celular = celular_anonimo(cliente.id)
    auditoria.registrar(
        db,
        None,
        "cliente_anonimizado",
        "cliente",
        cliente.id,
        {"citas_futuras_canceladas": len(futuras)},
    )
    db.commit()
    return ResultadoAnonimizar(cliente.id, len(futuras), limpiados, revocados, borrados)

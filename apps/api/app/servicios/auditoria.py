"""Registro de quién hizo qué. En `detalle` nunca van celulares completos ni claves.

`registrar` no cierra la transacción: la fila se guarda junto con el cambio que describe.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modelos import Auditoria, Usuario


def registrar(
    db: Session,
    usuario_id: int | None,
    accion: str,
    entidad: str,
    entidad_id: int | None = None,
    detalle: dict[str, Any] | None = None,
) -> Auditoria:
    fila = Auditoria(
        usuario_id=usuario_id,
        accion=accion,
        entidad=entidad,
        entidad_id=entidad_id,
        detalle=detalle,
    )
    db.add(fila)
    return fila


def texto(accion: str, detalle: dict[str, Any] | None) -> str:
    """La frase que se muestra en la pantalla; el detalle crudo no sale de la API."""
    d = detalle or {}
    quien = str(d.get("sobandero", "un sobandero"))
    if accion == "sobandero_creado":
        return f"Creó la cuenta de {quien}."
    if accion == "sobandero_editado":
        return f"Cambió los datos de {quien}."
    if accion == "horario_editado":
        return f"Cambió el horario de {quien}."
    if accion == "enlace_clave_enviado":
        return f"Envió a {quien} un enlace para cambiar su clave."
    if accion == "baja_dejar":
        return f"Dio de baja a {quien}. Sus citas próximas siguen agendadas."
    if accion == "baja_cancelar":
        n = int(d.get("citas_canceladas", 0))
        citas = "una cita" if n == 1 else f"{n} citas"
        return f"Dio de baja a {quien} y canceló {citas} con aviso."
    if accion == "baja_completada":
        return f"{quien} terminó sus citas y quedó dado de baja."
    if accion == "negocio_editado":
        return "Cambió los datos del negocio."
    return "Hizo un cambio."


def listar(db: Session, limite: int, antes: int | None) -> list[tuple[Auditoria, str | None]]:
    """Lo más reciente primero; `antes` es el id de la última fila ya vista."""
    consulta = (
        select(Auditoria, Usuario.nombre)
        .outerjoin(Usuario, Usuario.id == Auditoria.usuario_id)
        .order_by(Auditoria.id.desc())
        .limit(limite)
    )
    if antes is not None:
        consulta = consulta.where(Auditoria.id < antes)
    return [(fila, nombre) for fila, nombre in db.execute(consulta)]

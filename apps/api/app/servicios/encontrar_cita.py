"""«Encontrar mi cita»: el cliente pide su enlace por WhatsApp con solo su celular."""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modelos import Cita, Cliente, EnlaceCita, Sobandero
from app.seguridad.celular import enmascarar, normalizar_celular
from app.seguridad.tokens import hash_token
from app.servicios import auth, enlaces, notificaciones

registro = logging.getLogger("sobanderia.citas")

ENLACE = "enlace"  # tipo de intento; comparte la tabla de límites del ingreso


def enviar_enlace(db: Session, celular: str, ip: str, ahora: datetime) -> None:
    """Termina igual exista o no la cita; solo el límite de intentos o un número inválido cortan.

    Si hay una cita agendada por venir, rota su enlace (el anterior deja de servir) y deja el
    mensaje en la bandeja. El límite cuenta por celular (guardado como hash) y por IP, para que
    nadie use la app para escribir a números ajenos.
    """
    numero = normalizar_celular(celular)
    huella = hash_token(numero)
    auth.verificar_no_bloqueado(db, ENLACE, huella, ip)
    auth.registrar_intento(db, ENLACE, huella, ip)

    cliente = db.scalar(select(Cliente).where(Cliente.celular == numero))
    if cliente is None:
        return
    agendadas = db.scalars(
        select(Cita)
        .where(
            Cita.cliente_id == cliente.id,
            Cita.estado == "agendada",
        )
        .order_by(Cita.id)
    ).all()
    proximas = sorted((c for c in agendadas if c.inicio > ahora), key=lambda c: c.inicio)
    if not proximas:
        return
    elegida = proximas[0]
    enlace = db.scalars(select(EnlaceCita).where(EnlaceCita.cita_id == elegida.id)).one_or_none()
    sobandero = db.get(Sobandero, elegida.sobandero_id)
    if enlace is None or sobandero is None:
        return
    token = enlaces.mover_enlace(enlace, elegida, rotar=True)
    assert token is not None
    notificaciones.encolar(
        db, elegida, cliente, sobandero, "confirmacion", "cita_confirmada", ahora, token
    )
    db.commit()
    registro.info("enlace pedido cita=%s celular=%s", elegida.id, enmascarar(numero))

"""Lógica de ingreso, sesiones, límite de intentos, cambio de clave y recuperación."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.config import ajustes
from app.correo import EnviadorCorreo
from app.errores import (
    ErrorApi,
    clave_incorrecta,
    demasiados_intentos,
    enlace_vencido,
    no_autorizado,
)
from app.modelos import IntentoIngreso, RecuperacionClave, Sesion, Usuario
from app.seguridad.claves import (
    HASH_FALSO,
    hashear_clave,
    necesita_rehash,
    verificar_clave,
)
from app.seguridad.tokens import generar_token, hash_token

registro = logging.getLogger("sobanderia.auth")

INGRESO = "ingreso"
RECUPERAR = "recuperar"
CLAVE_ACTUAL = "clave_actual"
MENSAJE_INGRESO = "Correo o clave incorrectos."


def ahora() -> datetime:
    return datetime.now(UTC)


def normalizar_correo(correo: str) -> str:
    return correo.strip().lower()


# --- Límite de intentos ------------------------------------------------------------------


def _segundos_de_espera(
    sesion: Session,
    tipo: str,
    columna: str,
    valor: str,
    limite: int | None = None,
    ventana: timedelta | None = None,
) -> int:
    """Segundos que faltan para poder intentar de nuevo; 0 si no está bloqueado."""
    ventana = ventana or timedelta(minutes=ajustes.ventana_intentos_min)
    campo = IntentoIngreso.correo if columna == "correo" else IntentoIngreso.ip
    if limite is None:
        limite = ajustes.intentos_max_correo if columna == "correo" else ajustes.intentos_max_ip
    momentos = sesion.scalars(
        select(IntentoIngreso.momento)
        .where(
            IntentoIngreso.tipo == tipo, campo == valor, IntentoIngreso.momento > ahora() - ventana
        )
        .order_by(IntentoIngreso.momento.desc())
        .limit(limite)
    ).all()
    if len(momentos) < limite:
        return 0
    # El bloqueo termina cuando el intento más antiguo de los que cuentan sale de la ventana.
    return int((momentos[-1] + ventana - ahora()).total_seconds()) + 1


def verificar_no_bloqueado(
    sesion: Session,
    tipo: str,
    correo: str,
    ip: str,
    *,
    limite_correo: int | None = None,
    limite_ip: int | None = None,
    ventana: timedelta | None = None,
) -> None:
    """429 si `correo` (o el identificador que haga sus veces) o la IP pasaron su tope."""
    espera = max(
        _segundos_de_espera(sesion, tipo, "correo", correo, limite_correo, ventana),
        _segundos_de_espera(sesion, tipo, "ip", ip, limite_ip, ventana),
    )
    if espera > 0:
        raise demasiados_intentos(espera)


def registrar_intento(sesion: Session, tipo: str, correo: str, ip: str) -> None:
    sesion.add(IntentoIngreso(tipo=tipo, correo=correo[:254], ip=ip[:45]))
    sesion.commit()


# --- Sesiones ----------------------------------------------------------------------------


def crear_sesion(sesion: Session, usuario: Usuario) -> str:
    token = generar_token()
    sesion.add(
        Sesion(
            usuario_id=usuario.id,
            token_hash=hash_token(token),
            vence_en=ahora() + timedelta(hours=ajustes.sesion_inactividad_horas),
        )
    )
    return token


def cerrar_sesiones(sesion: Session, usuario_id: int, excepto_token: str | None = None) -> None:
    """Cierra las sesiones de un usuario (todas, o todas menos la del token dado)."""
    consulta = delete(Sesion).where(Sesion.usuario_id == usuario_id)
    if excepto_token:
        consulta = consulta.where(Sesion.token_hash != hash_token(excepto_token))
    sesion.execute(consulta)


def usuario_de_sesion(sesion: Session, token: str | None) -> Usuario | None:
    """Devuelve el usuario de una sesión válida y renueva su inactividad (sin pasar del máximo)."""
    if not token:
        return None
    fila = sesion.scalar(select(Sesion).where(Sesion.token_hash == hash_token(token)))
    if fila is None:
        return None
    momento = ahora()
    if fila.vence_en <= momento or not fila.usuario.activo:
        sesion.delete(fila)
        sesion.commit()
        return None
    fila.ultimo_uso = momento
    fila.vence_en = min(
        momento + timedelta(hours=ajustes.sesion_inactividad_horas),
        fila.creado_en + timedelta(days=ajustes.sesion_maxima_dias),
    )
    sesion.commit()
    return fila.usuario


# --- Ingreso -----------------------------------------------------------------------------


def ingresar(sesion: Session, correo: str, clave: str, ip: str) -> tuple[Usuario, str]:
    correo = normalizar_correo(correo)
    verificar_no_bloqueado(sesion, INGRESO, correo, ip)

    usuario = sesion.scalar(select(Usuario).where(Usuario.correo == correo))
    hash_a_verificar = usuario.clave_hash if usuario else HASH_FALSO
    clave_ok = verificar_clave(hash_a_verificar, clave)
    if usuario is None or not usuario.activo or not clave_ok:
        registrar_intento(sesion, INGRESO, correo, ip)
        raise no_autorizado(MENSAJE_INGRESO)

    if necesita_rehash(usuario.clave_hash):
        usuario.clave_hash = hashear_clave(clave)
    sesion.execute(
        delete(IntentoIngreso).where(
            IntentoIngreso.tipo == INGRESO, IntentoIngreso.correo == correo
        )
    )
    token = crear_sesion(sesion, usuario)
    sesion.commit()
    return usuario, token


def salir(sesion: Session, token: str | None) -> None:
    if token:
        sesion.execute(delete(Sesion).where(Sesion.token_hash == hash_token(token)))
        sesion.commit()


# --- Cambio de clave ---------------------------------------------------------------------


def _validar_clave_nueva(clave_nueva: str, clave_actual: str | None = None) -> None:
    if len(clave_nueva) < ajustes.clave_minimo:
        raise ErrorApi(
            422, "validacion", f"La clave debe tener al menos {ajustes.clave_minimo} caracteres."
        )
    if clave_actual is not None and clave_nueva == clave_actual:
        raise ErrorApi(422, "validacion", "La clave nueva debe ser distinta de la actual.")


def _avisar_cambio(enviador: EnviadorCorreo, usuario: Usuario) -> None:
    enviador.enviar(
        usuario.correo,
        "Su clave cambió",
        "La clave de su cuenta en Sobandería acaba de cambiar. "
        "Si no fue usted, pida un enlace de recuperación y avise al administrador.",
    )


def comprobar_clave_actual(sesion: Session, usuario: Usuario, clave_actual: str, ip: str) -> None:
    """La «clave actual» que se pide para cambiar la clave o el correo, con límite de intentos:
    una sesión robada no debe poder adivinarla sin tope (H-06)."""
    identificador = f"usuario:{usuario.id}"
    verificar_no_bloqueado(sesion, CLAVE_ACTUAL, identificador, ip)
    if not verificar_clave(usuario.clave_hash, clave_actual):
        registrar_intento(sesion, CLAVE_ACTUAL, identificador, ip)
        raise clave_incorrecta()
    sesion.execute(
        delete(IntentoIngreso).where(
            IntentoIngreso.tipo == CLAVE_ACTUAL, IntentoIngreso.correo == identificador
        )
    )


def cambiar_clave(
    sesion: Session,
    enviador: EnviadorCorreo,
    usuario: Usuario,
    token_actual: str,
    clave_actual: str,
    clave_nueva: str,
    ip: str,
) -> None:
    comprobar_clave_actual(sesion, usuario, clave_actual, ip)
    _validar_clave_nueva(clave_nueva, clave_actual)
    usuario.clave_hash = hashear_clave(clave_nueva)
    usuario.debe_cambiar_clave = False
    cerrar_sesiones(sesion, usuario.id, excepto_token=token_actual)
    sesion.commit()
    _avisar_cambio(enviador, usuario)


# --- Recuperación ------------------------------------------------------------------------


def pedir_recuperacion(sesion: Session, enviador: EnviadorCorreo, correo: str, ip: str) -> None:
    """Siempre termina igual exista o no el correo; solo el límite de intentos puede cortar."""
    correo = normalizar_correo(correo)
    verificar_no_bloqueado(sesion, RECUPERAR, correo, ip)
    registrar_intento(sesion, RECUPERAR, correo, ip)

    usuario = sesion.scalar(select(Usuario).where(Usuario.correo == correo))
    if usuario is None or not usuario.activo:
        return
    emitir_enlace_recuperacion(sesion, enviador, usuario)


def emitir_enlace_recuperacion(sesion: Session, enviador: EnviadorCorreo, usuario: Usuario) -> None:
    """Crea el enlace de un solo uso y lo envía (lo usan el sobandero y el administrador)."""
    # Un enlace nuevo invalida los anteriores.
    sesion.execute(
        update(RecuperacionClave)
        .where(RecuperacionClave.usuario_id == usuario.id, RecuperacionClave.usado.is_(False))
        .values(usado=True)
    )
    token = generar_token()
    sesion.add(
        RecuperacionClave(
            usuario_id=usuario.id,
            token_hash=hash_token(token),
            vence_en=ahora() + timedelta(hours=ajustes.recuperacion_horas),
        )
    )
    sesion.commit()
    enviador.enviar(
        usuario.correo,
        "Recupere su clave",
        f"Entre a {ajustes.origen_web}/restablecer/{token} para crear una clave nueva. "
        f"El enlace sirve una sola vez y vence en {ajustes.recuperacion_horas} horas.",
    )


def restablecer_clave(
    sesion: Session, enviador: EnviadorCorreo, token: str, clave_nueva: str
) -> None:
    _validar_clave_nueva(clave_nueva)
    # Comprobar y marcar como usado en una sola sentencia: dos peticiones no lo gastan dos veces.
    usuario_id = sesion.scalar(
        update(RecuperacionClave)
        .where(
            RecuperacionClave.token_hash == hash_token(token),
            RecuperacionClave.usado.is_(False),
            RecuperacionClave.vence_en > func.now(),
        )
        .values(usado=True)
        .returning(RecuperacionClave.usuario_id)
    )
    usuario = sesion.get(Usuario, usuario_id) if usuario_id else None
    if usuario is None or not usuario.activo:
        sesion.rollback()
        raise enlace_vencido()
    usuario.clave_hash = hashear_clave(clave_nueva)
    usuario.debe_cambiar_clave = False
    cerrar_sesiones(sesion, usuario.id)
    sesion.commit()
    _avisar_cambio(enviador, usuario)

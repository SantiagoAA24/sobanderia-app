"""Panel del administrador: resumen, agenda, sobanderos, baja, negocio y actividad."""

import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.correo import EnviadorCorreo, enmascarar_correo
from app.errores import ErrorApi, no_encontrado
from app.modelos import Cita, Cliente, Horario, Negocio, Sobandero, Usuario
from app.seguridad.claves import hashear_clave
from app.servicios import auditoria, bajas, citas
from app.servicios import auth as servicio_auth
from app.servicios import horario as servicio_horario
from app.servicios.horas import a_utc, dia_local

registro = logging.getLogger("sobanderia.admin")

DURACIONES = (20, 30, 45, 60)


def _correo_en_uso() -> ErrorApi:
    return ErrorApi(409, "correo_en_uso", "Ese correo ya está en uso. Escriba otro.")


# --- Sobanderos -------------------------------------------------------------------------------


def obtener(db: Session, sobandero_id: int) -> Sobandero:
    sobandero = db.get(Sobandero, sobandero_id)
    if sobandero is None:
        raise no_encontrado("No encontramos a ese sobandero.")
    return sobandero


@dataclass
class FichaSobandero:
    sobandero: Sobandero
    dias: list[int]  # días de la semana con atención (0 = lunes)
    citas_proximas: int


def _citas_proximas(db: Session, sobandero_id: int, ahora: datetime) -> int:
    return (
        db.scalar(
            select(func.count(Cita.id)).where(
                Cita.sobandero_id == sobandero_id,
                Cita.estado == "agendada",
                Cita.rango.overlaps(Range(ahora, None, bounds="[)")),
            )
        )
        or 0
    )


def ficha(db: Session, sobandero: Sobandero, ahora: datetime) -> FichaSobandero:
    dias = db.scalars(
        select(Horario.dia_semana)
        .where(Horario.sobandero_id == sobandero.id)
        .distinct()
        .order_by(Horario.dia_semana)
    ).all()
    return FichaSobandero(sobandero, list(dias), _citas_proximas(db, sobandero.id, ahora))


def listar_sobanderos(
    db: Session, ahora: datetime, incluir_inactivos: bool
) -> list[FichaSobandero]:
    consulta = select(Sobandero).join(Usuario, Usuario.id == Sobandero.usuario_id)
    if not incluir_inactivos:
        consulta = consulta.where(Usuario.activo)
    return [ficha(db, s, ahora) for s in db.scalars(consulta.order_by(Sobandero.id))]


def crear_sobandero(
    db: Session,
    admin: Usuario,
    nombre: str,
    correo: str,
    clave_temporal: str,
    duracion_min: int,
) -> Sobandero:
    """La clave temporal solo se guarda con hash; nadie vuelve a verla y debe cambiarse."""
    if db.scalar(select(Usuario.id).where(Usuario.correo == correo)) is not None:
        raise _correo_en_uso()
    usuario = Usuario(
        correo=correo,
        nombre=nombre,
        clave_hash=hashear_clave(clave_temporal),
        rol="sobandero",
        debe_cambiar_clave=True,
    )
    sobandero = Sobandero(usuario=usuario, duracion_min=duracion_min)
    db.add(sobandero)
    try:
        db.flush()
    except IntegrityError as error:  # otro administrador tomó el correo a la vez
        db.rollback()
        raise _correo_en_uso() from error
    auditoria.registrar(
        db, admin.id, "sobandero_creado", "sobandero", sobandero.id, {"sobandero": nombre}
    )
    db.commit()
    registro.info("sobandero creado id=%s por=%s", sobandero.id, admin.id)
    return sobandero


def editar_sobandero(
    db: Session,
    enviador: EnviadorCorreo,
    admin: Usuario,
    sobandero: Sobandero,
    cambios: dict[str, object],
) -> Sobandero:
    usuario = sobandero.usuario
    anterior = usuario.correo
    correo = cambios.get("correo")
    if correo is not None and correo != anterior:
        otro = db.scalar(
            select(Usuario.id).where(Usuario.correo == correo, Usuario.id != usuario.id)
        )
        if otro is not None:
            raise _correo_en_uso()
    if (nombre := cambios.get("nombre")) is not None:
        usuario.nombre = str(nombre)
    if correo is not None:
        usuario.correo = str(correo)
    if (recibe := cambios.get("recibe_citas")) is not None:
        sobandero.recibe_citas = bool(recibe)
    if (duracion := cambios.get("duracion_min")) is not None:
        sobandero.duracion_min = int(str(duracion))  # solo aplica a las citas nuevas
    auditoria.registrar(
        db,
        admin.id,
        "sobandero_editado",
        "sobandero",
        sobandero.id,
        {"sobandero": usuario.nombre, "campos": sorted(cambios)},
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise _correo_en_uso() from error
    if usuario.correo != anterior:
        enviador.enviar(
            anterior,
            "Su correo cambió",
            "El administrador cambió el correo de su cuenta en Sobandería. "
            f"El nuevo es {enmascarar_correo(usuario.correo)}.",
        )
    return sobandero


def guardar_horario(
    db: Session,
    admin: Usuario,
    sobandero: Sobandero,
    dias: dict[int, list[tuple[time, time]]],
) -> dict[int, list[tuple[time, time]]]:
    """Igual que el sobandero: no toca las citas ya agendadas."""
    semana = servicio_horario.guardar_horario(db, sobandero, dias, confirmar=False)
    auditoria.registrar(
        db,
        admin.id,
        "horario_editado",
        "sobandero",
        sobandero.id,
        {"sobandero": sobandero.usuario.nombre},
    )
    db.commit()
    return semana


def enviar_enlace_clave(
    db: Session, enviador: EnviadorCorreo, admin: Usuario, sobandero: Sobandero
) -> None:
    servicio_auth.emitir_enlace_recuperacion(db, enviador, sobandero.usuario)
    auditoria.registrar(
        db,
        admin.id,
        "enlace_clave_enviado",
        "sobandero",
        sobandero.id,
        {"sobandero": sobandero.usuario.nombre},
    )
    db.commit()


@dataclass
class ResultadoBaja:
    sobandero: Sobandero
    citas_canceladas: int


def dar_de_baja(
    db: Session, admin: Usuario, sobandero: Sobandero, que_hacer: str, ahora: datetime
) -> ResultadoBaja:
    """Todo o nada: las cancelaciones, sus avisos, la desactivación y el registro van juntos."""
    usuario = sobandero.usuario
    if not usuario.activo:
        raise ErrorApi(409, "ya_dado_de_baja", "Esta cuenta ya está dada de baja.")
    canceladas = 0
    try:
        sobandero.recibe_citas = False
        if sobandero.baja_en is None:
            sobandero.baja_en = ahora
        if que_hacer == "cancelar":
            proximas = db.scalars(
                select(Cita)
                .where(
                    Cita.sobandero_id == sobandero.id,
                    Cita.estado == "agendada",
                    Cita.rango.overlaps(Range(ahora, None, bounds="[)")),
                )
                .order_by(Cita.rango)
            ).all()
            for cita in proximas:
                citas.cancelar_sin_guardar(db, cita, ahora, "admin")
                canceladas += 1
            bajas.desactivar(db, sobandero)
            auditoria.registrar(
                db,
                admin.id,
                "baja_cancelar",
                "sobandero",
                sobandero.id,
                {"sobandero": usuario.nombre, "citas_canceladas": canceladas},
            )
        else:
            pendiente = db.scalar(
                select(Cita.id)
                .where(Cita.sobandero_id == sobandero.id, Cita.estado == "agendada")
                .limit(1)
            )
            if pendiente is None:
                bajas.desactivar(db, sobandero)
            auditoria.registrar(
                db,
                admin.id,
                "baja_dejar",
                "sobandero",
                sobandero.id,
                {"sobandero": usuario.nombre},
            )
        db.commit()
    except BaseException:
        db.rollback()
        raise
    registro.info(
        "sobandero dado de baja id=%s citas=%s canceladas=%s", sobandero.id, que_hacer, canceladas
    )
    return ResultadoBaja(sobandero, canceladas)


# --- Resumen y agenda -------------------------------------------------------------------------


def _ventana(dia: date) -> Range[datetime]:
    return Range(a_utc(dia, time(0)), a_utc(dia + timedelta(days=1), time(0)), bounds="[)")


@dataclass
class FilaResumen:
    sobandero: Sobandero
    citas: int
    siguiente: datetime | None


def resumen(db: Session, dia: date, ahora: datetime) -> tuple[int, list[FilaResumen]]:
    """Citas del día (sin canceladas) y una fila por sobandero activo."""
    ventana = _ventana(dia)
    filas = db.execute(
        select(Cita.sobandero_id, Cita.rango, Cita.estado).where(
            Cita.rango.overlaps(ventana), Cita.estado != "cancelada"
        )
    ).all()
    activos = db.scalars(
        select(Sobandero)
        .join(Usuario, Usuario.id == Sobandero.usuario_id)
        .where(Usuario.activo)
        .order_by(Sobandero.id)
    ).all()
    por: list[FilaResumen] = []
    for sobandero in activos:
        propias = [(r, e) for sid, r, e in filas if sid == sobandero.id]
        proximas = [
            inicio
            for r, e in propias
            if e == "agendada" and (inicio := r.lower) is not None and inicio > ahora
        ]
        por.append(FilaResumen(sobandero, len(propias), min(proximas) if proximas else None))
    return len(filas), por


def agenda(db: Session, dia: date) -> list[tuple[Cita, Cliente, Sobandero]]:
    consulta = (
        select(Cita, Cliente, Sobandero)
        .join(Cliente, Cliente.id == Cita.cliente_id)
        .join(Sobandero, Sobandero.id == Cita.sobandero_id)
        .where(Cita.rango.overlaps(_ventana(dia)), Cita.estado != "cancelada")
        .order_by(Cita.rango, Cita.sobandero_id)
    )
    return [(c, cl, s) for c, cl, s in db.execute(consulta)]


def dia_de_hoy(ahora: datetime) -> date:
    return dia_local(ahora)


# --- Negocio ----------------------------------------------------------------------------------


def ver_negocio(db: Session) -> Negocio:
    negocio = db.get(Negocio, 1)
    if negocio is None:
        raise no_encontrado("Todavía no hay datos del negocio.")
    return negocio


def guardar_negocio(
    db: Session, admin: Usuario, nombre: str, direccion: str, telefono: str, mensaje: str
) -> Negocio:
    negocio = db.get(Negocio, 1)
    if negocio is None:
        negocio = Negocio(id=1)
        db.add(negocio)
    negocio.nombre = nombre
    negocio.direccion = direccion
    negocio.telefono = telefono
    negocio.mensaje_bienvenida = mensaje
    auditoria.registrar(db, admin.id, "negocio_editado", "negocio", 1)
    db.commit()
    return negocio

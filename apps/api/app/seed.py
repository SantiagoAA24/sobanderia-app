"""Datos de ejemplo para desarrollo: `python -m app.seed`. Repetible y solo en desarrollo."""

import os
import secrets
import sys
from datetime import time

from argon2 import PasswordHasher
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import ajustes
from app.db import sesion_nueva
from app.modelos import Horario, Negocio, Sobandero, Usuario

ENTORNOS_PERMITIDOS = {"desarrollo", "pruebas"}
CORREO_ADMIN = "admin@sobanderia.test"
SOBANDEROS = [
    ("sobandero1@sobanderia.test", "Sobandero Uno", 30),
    ("sobandero2@sobanderia.test", "Sobandero Dos", 30),
    ("sobandero3@sobanderia.test", "Sobandero Tres", 45),
    ("sobandero4@sobanderia.test", "Sobandero Cuatro", 60),
]
# Lunes a viernes de 8:00 a 12:00 y de 14:00 a 18:00; sábado solo en la mañana (hora de Bogotá).
FRANJAS = [(dia, time(8), time(12)) for dia in range(6)] + [
    (dia, time(14), time(18)) for dia in range(5)
]


class EntornoNoPermitido(RuntimeError):
    pass


def sembrar(sesion: Session, entorno: str, clave: str | None = None) -> str | None:
    """Crea lo que falte. Devuelve la clave generada si hubo que crear usuarios, si no None."""
    if entorno not in ENTORNOS_PERMITIDOS:
        raise EntornoNoPermitido(f"El seed no corre en el entorno «{entorno}».")

    clave_usada = clave or secrets.token_urlsafe(12)
    hash_clave = PasswordHasher().hash(clave_usada)
    creados = False

    def usuario(correo: str, nombre: str, rol: str) -> Usuario:
        nonlocal creados
        existente = sesion.scalar(select(Usuario).where(Usuario.correo == correo))
        if existente:
            return existente
        creados = True
        nuevo = Usuario(correo=correo, nombre=nombre, clave_hash=hash_clave, rol=rol)
        sesion.add(nuevo)
        sesion.flush()
        return nuevo

    usuario(CORREO_ADMIN, "Administrador", "admin")

    for correo, nombre, duracion in SOBANDEROS:
        cuenta = usuario(correo, nombre, "sobandero")
        perfil = sesion.scalar(select(Sobandero).where(Sobandero.usuario_id == cuenta.id))
        if perfil is None:
            perfil = Sobandero(usuario_id=cuenta.id, duracion_min=duracion)
            sesion.add(perfil)
            sesion.flush()
        for dia, desde, hasta in FRANJAS:
            ya_existe = sesion.scalar(
                select(Horario.id).where(
                    Horario.sobandero_id == perfil.id,
                    Horario.dia_semana == dia,
                    Horario.desde == desde,
                )
            )
            if ya_existe is None:
                sesion.add(
                    Horario(sobandero_id=perfil.id, dia_semana=dia, desde=desde, hasta=hasta)
                )

    if sesion.get(Negocio, 1) is None:
        sesion.add(
            Negocio(
                id=1,
                nombre="Sobandería",
                direccion="Dirección de ejemplo",
                telefono="+573000000000",
                mensaje_bienvenida="Bienvenido. Agende su cita en pocos pasos.",
            )
        )
    sesion.flush()
    return clave_usada if creados else None


def main() -> int:
    try:
        with sesion_nueva() as sesion:
            clave = sembrar(sesion, ajustes.entorno, os.environ.get("SEED_CLAVE"))
            sesion.commit()
    except EntornoNoPermitido as error:
        print(error, file=sys.stderr)
        return 1
    if clave:
        print(f"Usuarios de ejemplo creados. Clave inicial (se muestra una sola vez): {clave}")
    else:
        print("Los datos de ejemplo ya estaban cargados; no se cambió nada.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

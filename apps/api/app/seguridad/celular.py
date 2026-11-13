"""Celulares: se normalizan a E.164 y nunca se registran completos."""

import re

from app.errores import ErrorApi

E164 = re.compile(r"^\+[1-9][0-9]{7,14}$")


def normalizar_celular(texto: str) -> str:
    """«300 123 4567», «+57 300 123 4567» y «573001234567» dan «+573001234567»."""
    limpio = re.sub(r"[\s\-().]", "", texto)
    if limpio.startswith("+"):
        candidato = limpio
    elif re.fullmatch(r"3[0-9]{9}", limpio):
        candidato = f"+57{limpio}"
    elif re.fullmatch(r"57[0-9]{10}", limpio):
        candidato = f"+{limpio}"
    else:
        candidato = ""
    if not E164.fullmatch(candidato):
        raise ErrorApi(422, "validacion", "Revise su número de celular.")
    return candidato


def enmascarar(celular: str) -> str:
    """«+573001234567» -> «300 *** 4567»"""
    if celular.startswith("+57") and len(celular) == 13:
        return f"{celular[3:6]} *** {celular[-4:]}"
    return f"*** {celular[-4:]}"

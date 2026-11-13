"""Claves con argon2id."""

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()  # argon2id por defecto


def hashear_clave(clave: str) -> str:
    return _hasher.hash(clave)


def verificar_clave(hash_guardado: str, clave: str) -> bool:
    try:
        return _hasher.verify(hash_guardado, clave)
    except (VerificationError, InvalidHashError):
        return False


def necesita_rehash(hash_guardado: str) -> bool:
    return _hasher.check_needs_rehash(hash_guardado)


# Se verifica contra este hash cuando el correo no existe, para que tarde lo mismo.
HASH_FALSO = hashear_clave("clave-que-nadie-usa")

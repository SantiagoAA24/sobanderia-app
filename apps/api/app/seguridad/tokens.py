"""Tokens aleatorios: el valor real viaja una vez; en la base solo queda su hash."""

import hashlib
import secrets


def generar_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

"""Reloj inyectable: las pruebas lo reemplazan para fijar «ahora»."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends


def reloj() -> datetime:
    return datetime.now(UTC)


Ahora = Annotated[datetime, Depends(reloj)]

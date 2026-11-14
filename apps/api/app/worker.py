"""Worker de WhatsApp: revisa la bandeja `notificaciones` cada pocos segundos y envía.

Se puede correr más de uno a la vez; la bandeja los mantiene sin pisarse.
"""

import logging
import signal
import time
from datetime import UTC, datetime
from types import FrameType

from app.config import ajustes
from app.db import sesion_nueva
from app.servicios import bandeja, mantenimiento
from app.whatsapp import ProveedorWhatsApp, crear_proveedor

logging.basicConfig(level=logging.INFO, format="%(message)s")
registro = logging.getLogger("worker")

_detener = False


def _pedir_parada(_senal: int, _marco: FrameType | None) -> None:
    global _detener
    _detener = True


def una_vuelta(proveedor: ProveedorWhatsApp) -> int:
    with sesion_nueva() as db:
        return bandeja.vaciar(db, proveedor, datetime.now(UTC))


def limpiar() -> None:
    with sesion_nueva() as db:
        borradas = mantenimiento.purgar(db, datetime.now(UTC))
    if borradas.total:
        registro.info(
            "limpieza intentos=%s sesiones=%s recuperaciones=%s enlaces=%s",
            borradas.intentos,
            borradas.sesiones,
            borradas.recuperaciones,
            borradas.enlaces,
        )


def main() -> None:
    signal.signal(signal.SIGTERM, _pedir_parada)
    signal.signal(signal.SIGINT, _pedir_parada)
    proveedor = crear_proveedor()
    registro.info("worker activo proveedor=%s", ajustes.proveedor_whatsapp)
    proxima_limpieza = 0.0
    while not _detener:
        try:
            atendidas = una_vuelta(proveedor)
            if atendidas:
                registro.info("worker atendio=%s", atendidas)
            if time.monotonic() >= proxima_limpieza:
                proxima_limpieza = time.monotonic() + ajustes.limpieza_cada_min * 60
                limpiar()
        except Exception:  # un fallo de base o de red no debe tumbar al worker
            registro.exception("worker vuelta fallida")
        time.sleep(ajustes.worker_pausa_seg)
    registro.info("worker detenido")


if __name__ == "__main__":
    main()

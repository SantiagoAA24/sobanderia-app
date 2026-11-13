"""Worker de WhatsApp. En la Fase 0 solo mantiene el proceso vivo; la bandeja llega en la Fase 8."""

import logging
import time

logging.basicConfig(level=logging.INFO, format="%(message)s")
registro = logging.getLogger("worker")


def main() -> None:
    registro.info("worker activo")
    while True:
        time.sleep(5)


if __name__ == "__main__":
    main()

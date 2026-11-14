"""Datos de un cliente desde la línea de comandos (Ley 1581 de 2012).

    python -m app.cli_datos exportar   --celular 300... --salida cliente.json
    python -m app.cli_datos anonimizar --celular 300... [--cancelar-citas-futuras] [--confirmar]

`anonimizar` sin `--confirmar` solo muestra lo que haría. Nada de esto escribe el celular completo
en la pantalla ni en el registro: el export va a un archivo (permisos 0600) que no se sobrescribe.
"""

import argparse
import json
import os
import sys
from datetime import UTC, datetime

from app.db import sesion_nueva
from app.errores import ErrorApi
from app.seguridad.celular import enmascarar
from app.servicios import datos_cliente as servicio


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python -m app.cli_datos", description=__doc__)
    sub = p.add_subparsers(dest="orden", required=True)
    e = sub.add_parser("exportar", help="guarda en un archivo todo lo que se tiene de la persona")
    e.add_argument("--celular", required=True)
    e.add_argument("--salida", required=True, help="archivo JSON nuevo (no se sobrescribe)")
    a = sub.add_parser("anonimizar", help="quita nombre y celular y conserva el historial")
    a.add_argument("--celular", required=True)
    a.add_argument("--cancelar-citas-futuras", action="store_true")
    a.add_argument("--confirmar", action="store_true", help="sin esto solo muestra qué haría")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    ahora = datetime.now(UTC)
    try:
        with sesion_nueva() as db:
            cliente = servicio.buscar_cliente(db, args.celular)
            etiqueta = enmascarar(cliente.celular)
            if args.orden == "exportar":
                datos = servicio.exportar(db, cliente, ahora)
                descriptor = os.open(args.salida, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(descriptor, "w", encoding="utf-8") as archivo:
                    json.dump(datos, archivo, ensure_ascii=False, indent=2)
                print(
                    f"Datos de {etiqueta} guardados en {args.salida} "
                    f"({len(datos['citas'])} citas, {len(datos['mensajes'])} mensajes)."
                )
                return 0
            futuras = servicio.citas_futuras_agendadas(db, cliente, ahora)
            if not args.confirmar:
                print(
                    f"Cliente {etiqueta}: se anonimizaría su nombre y celular y se conservarían "
                    f"sus citas. Citas futuras agendadas: {len(futuras)}. "
                    "Repita con --confirmar para hacerlo."
                )
                return 0
            r = servicio.anonimizar(db, cliente, ahora, args.cancelar_citas_futuras)
            print(
                f"Cliente {etiqueta} anonimizado: {r.citas_futuras_canceladas} citas futuras "
                f"canceladas, {r.mensajes_limpiados} mensajes limpiados, "
                f"{r.enlaces_revocados} enlaces revocados."
            )
            return 0
    except ErrorApi as error:
        print(error.mensaje, file=sys.stderr)
        return 1
    except FileExistsError:
        print("El archivo de salida ya existe: elija otro nombre.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

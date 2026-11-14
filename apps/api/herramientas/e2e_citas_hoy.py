"""Agrega citas de HOY (hora de Bogotá) a un sobandero y escribe sus ids en JSON.

Sirve para probar «atendida» y «no asistió» sin depender de la hora del reloj: se colocan en la
madrugada, en huecos libres, con clientes nuevos. Uso: `python -m herramientas.e2e_citas_hoy 1 2`
(número de sobandero y cuántas citas).
"""

import json
import secrets
import sys
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import Range

from app.config import ajustes
from app.db import sesion_nueva
from app.modelos import Cita, Cliente, Sobandero, Usuario
from herramientas.seguridad_e2e import exigir_base_e2e


def main(numero: int, cuantas: int) -> None:
    exigir_base_e2e()
    zona = ZoneInfo(ajustes.tz_negocio)
    medianoche = datetime.now(zona).replace(hour=0, minute=0, second=0, microsecond=0)
    ids: list[int] = []
    with sesion_nueva() as sesion:
        correo = f"sobandero{numero}@sobanderia.test"
        yo = sesion.scalar(
            select(Sobandero)
            .join(Usuario, Sobandero.usuario_id == Usuario.id)
            .where(Usuario.correo == correo)
        )
        if yo is None:
            raise SystemExit(f"No existe {correo}")
        inicio = medianoche
        while len(ids) < cuantas:
            fin = inicio + timedelta(minutes=30)
            rango = Range(inicio.astimezone(UTC), fin.astimezone(UTC), bounds="[)")
            choca = sesion.scalar(
                select(Cita.id).where(
                    Cita.sobandero_id == yo.id,
                    Cita.estado != "cancelada",
                    Cita.rango.overlaps(rango),
                )
            )
            if choca is None:
                cliente = Cliente(
                    nombre="Cliente Hoy",
                    celular=f"+57320{secrets.randbelow(10_000_000):07d}",
                    politica_aceptada_en=datetime.now(UTC),
                    politica_version=ajustes.politica_version,
                )
                sesion.add(cliente)
                sesion.flush()
                cita = Cita(
                    sobandero_id=yo.id,
                    cliente_id=cliente.id,
                    rango=rango,
                    estado="agendada",
                    origen="sobandero",
                )
                sesion.add(cita)
                sesion.flush()
                cliente.nombre = f"Cliente Hoy {cita.id}"  # único, para encontrarla en pantalla
                ids.append(cita.id)
            inicio += timedelta(minutes=40)
        sesion.commit()
    print(json.dumps({"ids": ids}))


if __name__ == "__main__":
    main(int(sys.argv[1]), int(sys.argv[2]))

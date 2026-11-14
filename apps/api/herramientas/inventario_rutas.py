"""Inventario de endpoints con las dependencias de seguridad que de verdad tienen.

`python -m herramientas.inventario_rutas` lo imprime; `tests/test_seguridad_rutas.py` lo usa para
exigir que cada endpoint esté en `docs/SEGURIDAD.md` y para recorrer todas las rutas protegidas.
"""

from dataclasses import dataclass
from typing import Any

from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute

from app.main import app

SEGURIDAD = {
    "exige_csrf",
    "sesion_activa",
    "usuario_actual",
    "requiere_sobandero",
    "requiere_admin",
    "sobandero_actual",
}


@dataclass(frozen=True)
class RutaInventario:
    metodo: str
    ruta: str
    seguridad: frozenset[str]

    @property
    def clave(self) -> str:
        return f"{self.metodo} {self.ruta}"

    @property
    def nivel(self) -> str:
        """Quién puede llamarla, deducido de las dependencias (no de la documentación)."""
        if "requiere_admin" in self.seguridad:
            return "admin"
        if "sobandero_actual" in self.seguridad or "requiere_sobandero" in self.seguridad:
            return "sobandero"
        if "usuario_actual" in self.seguridad:
            return "sesion"
        if "sesion_activa" in self.seguridad:
            return "sesion_cualquiera"
        return "publica"


def _dependencias(dependant: Dependant, acumulado: set[str]) -> set[str]:
    for sub in dependant.dependencies:
        acumulado.add(getattr(sub.call, "__name__", str(sub.call)))
        _dependencias(sub, acumulado)
    return acumulado


def _contextos(app_: Any) -> list[Any]:
    contextos: list[Any] = []
    for ruta in app_.routes:
        if isinstance(ruta, APIRoute):
            contextos.append(ruta)
        elif hasattr(ruta, "effective_route_contexts"):
            contextos.extend(ruta.effective_route_contexts())
    return contextos


def rutas() -> list[RutaInventario]:
    inventario: list[RutaInventario] = []
    for c in _contextos(app):
        seguridad = frozenset(_dependencias(c.dependant, set()) & SEGURIDAD)
        for metodo in sorted(c.methods - {"HEAD", "OPTIONS"}):
            inventario.append(RutaInventario(metodo, c.path, seguridad))
    return sorted(inventario, key=lambda r: (r.ruta, r.metodo))


if __name__ == "__main__":
    for r in rutas():
        print(f"{r.metodo:7} {r.ruta:52} {r.nivel:18} {' '.join(sorted(r.seguridad))}")
    print(len(rutas()), "endpoints")

"""IP de quien llama, para los límites de intentos.

Detrás de un proxy (Caddy, el ingreso de Azure) `request.client.host` es la IP del proxy: todos
parecerían la misma persona. Se lee `X-Forwarded-For` solo si quien se conecta es un proxy de
confianza (`PROXY_CONFIABLE`); de lo contrario cualquiera podría inventar su IP.
"""

from ipaddress import ip_address, ip_network

from fastapi import Request

from app.config import ajustes


def _confiables() -> list[str]:
    return [x.strip() for x in ajustes.proxy_confiable.split(",") if x.strip()]


def _es_confiable(direccion: str, confiables: list[str]) -> bool:
    for entrada in confiables:
        if direccion == entrada:
            return True
        try:
            if ip_address(direccion) in ip_network(entrada, strict=False):
                return True
        except ValueError:
            continue
    return False


def ip_del_cliente(request: Request) -> str:
    """La IP del cliente; si la cadena de proxies es de confianza, la primera que no lo sea."""
    directa = request.client.host if request.client else "desconocida"
    confiables = _confiables()
    if not confiables or not _es_confiable(directa, confiables):
        return directa
    cadena = [x.strip() for x in request.headers.get("X-Forwarded-For", "").split(",") if x.strip()]
    for direccion in reversed(cadena):  # de derecha a izquierda: lo último lo añadió nuestro proxy
        if not _es_confiable(direccion, confiables):
            return direccion[:45]
    return cadena[0][:45] if cadena else directa

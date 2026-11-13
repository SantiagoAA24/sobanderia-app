"""Webhook de WhatsApp. Lo llama Meta, no la app: no usa cookie ni cabecera CSRF.

La defensa de esta ruta es la firma `X-Hub-Signature-256` (HMAC-SHA256 del cuerpo con el secreto
de la app de Meta). Sin secreto configurado, nada se acepta.
"""

import hashlib
import hmac
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from app.config import ajustes
from app.db import obtener_sesion
from app.errores import sin_permiso
from app.reloj import Ahora
from app.servicios import respuestas_whatsapp
from app.whatsapp import ProveedorWhatsApp, obtener_proveedor

router = APIRouter(prefix="/webhooks/whatsapp", tags=["webhooks"], include_in_schema=False)
Db = Annotated[Session, Depends(obtener_sesion)]


@router.get("")
def verificar(
    modo: Annotated[str | None, Query(alias="hub.mode")] = None,
    token: Annotated[str | None, Query(alias="hub.verify_token")] = None,
    reto: Annotated[str | None, Query(alias="hub.challenge")] = None,
) -> Response:
    """Meta pide esto una vez al registrar el webhook."""
    esperado = ajustes.whatsapp_verify_token
    if modo != "subscribe" or not esperado or not token or reto is None:
        raise sin_permiso("Verificación rechazada.")
    if not hmac.compare_digest(token.encode(), esperado.encode()):
        raise sin_permiso("Verificación rechazada.")
    return Response(content=reto, media_type="text/plain")


async def _cuerpo_firmado(request: Request) -> bytes:
    cuerpo = await request.body()
    firma = request.headers.get("X-Hub-Signature-256", "")
    secreto = ajustes.whatsapp_app_secret
    if not secreto or not firma.startswith("sha256="):
        raise sin_permiso("Firma no válida.")
    calculada = hmac.new(secreto.encode(), cuerpo, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculada, firma.removeprefix("sha256=").lower()):
        raise sin_permiso("Firma no válida.")
    return cuerpo


@router.post("")
def recibir(
    cuerpo: Annotated[bytes, Depends(_cuerpo_firmado)],
    db: Db,
    proveedor: Annotated[ProveedorWhatsApp, Depends(obtener_proveedor)],
    ahora: Ahora,
) -> Response:
    try:
        carga = json.loads(cuerpo)
    except ValueError:
        return Response(status_code=200)  # firmado pero ilegible: reintentar no lo arregla
    respuestas_whatsapp.procesar(db, carga, proveedor, ahora)
    return Response(status_code=200)

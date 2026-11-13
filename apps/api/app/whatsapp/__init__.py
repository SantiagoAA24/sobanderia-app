"""Envío de mensajes por WhatsApp: interfaz, proveedor falso y Cloud API de Meta."""

from functools import lru_cache

from app.config import Ajustes, ajustes
from app.whatsapp.cloud_api import CloudApi
from app.whatsapp.falso import Falso
from app.whatsapp.proveedor import (
    ErrorEnvio,
    ErrorPermanente,
    ErrorTemporal,
    Mensaje,
    ProveedorWhatsApp,
)

__all__ = [
    "CloudApi",
    "ErrorEnvio",
    "ErrorPermanente",
    "ErrorTemporal",
    "Falso",
    "Mensaje",
    "ProveedorWhatsApp",
    "crear_proveedor",
    "obtener_proveedor",
]


def crear_proveedor(config: Ajustes = ajustes) -> ProveedorWhatsApp:
    """«falso» por defecto; «cloudapi» exige token y número de teléfono."""
    if config.proveedor_whatsapp == "falso":
        return Falso()
    if config.proveedor_whatsapp == "cloudapi":
        if not config.whatsapp_token or not config.whatsapp_phone_number_id:
            raise ValueError("cloudapi necesita WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID")
        return CloudApi(
            token=config.whatsapp_token,
            phone_number_id=config.whatsapp_phone_number_id,
            version=config.whatsapp_version_api,
            idioma=config.whatsapp_idioma,
        )
    raise ValueError(f"PROVEEDOR_WHATSAPP desconocido: {config.proveedor_whatsapp}")


@lru_cache
def obtener_proveedor() -> ProveedorWhatsApp:
    """Dependencia de FastAPI: un solo proveedor por proceso."""
    return crear_proveedor()

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import SOLO_DESARROLLO, ajustes
from app.errores import registrar_manejadores
from app.rutas import (
    admin,
    auth,
    mi_cita,
    publico,
    webhook_whatsapp,
    yo_agenda,
    yo_citas,
    yo_clientes,
    yo_perfil,
)

# La documentación interactiva (/docs, /redoc) carga scripts de fuera: se le exime de la CSP.
RUTAS_DE_DOCUMENTACION = ("/docs", "/redoc", "/openapi.json")
CABECERAS_DE_SEGURIDAD = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    # La API solo habla JSON: no necesita cargar nada ni mostrarse dentro de otra página.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    # Datos personales y enlaces de cita: no deben quedar en cachés del navegador ni del proxy.
    "Cache-Control": "no-store",
}


def crear_app(entorno: str) -> FastAPI:
    """Fuera de desarrollo y pruebas la documentación de la API no se publica (H-03). El contrato
    para el cliente de la web se escribe con `python -m app.openapi`, no por HTTP."""
    abierta = entorno in SOLO_DESARROLLO
    app = FastAPI(
        title="Sobandería API",
        docs_url="/docs" if abierta else None,
        redoc_url="/redoc" if abierta else None,
        openapi_url="/openapi.json" if abierta else None,
    )
    registrar_manejadores(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[ajustes.origen_web],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-Sobanderia"],
    )

    @app.middleware("http")
    async def cabeceras_de_seguridad(request: Request, llamar_a_siguiente) -> Response:  # type: ignore[no-untyped-def]
        respuesta: Response = await llamar_a_siguiente(request)
        documentacion = request.url.path in RUTAS_DE_DOCUMENTACION
        for nombre, valor in CABECERAS_DE_SEGURIDAD.items():
            if documentacion and nombre == "Content-Security-Policy":
                continue
            respuesta.headers.setdefault(nombre, valor)
        return respuesta

    for modulo in (auth, publico, mi_cita, yo_citas, yo_agenda, yo_clientes, yo_perfil, admin):
        app.include_router(modulo.router)
    app.include_router(webhook_whatsapp.router)

    @app.get("/salud")
    def salud() -> dict[str, str]:
        return {"estado": "ok"}

    return app


app = crear_app(ajustes.entorno)

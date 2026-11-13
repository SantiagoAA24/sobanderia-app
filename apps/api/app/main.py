from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ajustes
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

app = FastAPI(title="Sobandería API")
registrar_manejadores(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ajustes.origen_web],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Sobanderia"],
)

app.include_router(auth.router)
app.include_router(publico.router)
app.include_router(mi_cita.router)
app.include_router(yo_citas.router)
app.include_router(yo_agenda.router)
app.include_router(yo_clientes.router)
app.include_router(yo_perfil.router)
app.include_router(admin.router)
app.include_router(webhook_whatsapp.router)


@app.get("/salud")
def salud() -> dict[str, str]:
    return {"estado": "ok"}

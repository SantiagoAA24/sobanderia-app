from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ajustes
from app.errores import registrar_manejadores
from app.rutas import auth, mi_cita, publico, yo_citas

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


@app.get("/salud")
def salud() -> dict[str, str]:
    return {"estado": "ok"}

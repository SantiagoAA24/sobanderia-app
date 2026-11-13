from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ajustes

app = FastAPI(title="Sobandería API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ajustes.origen_web],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/salud")
def salud() -> dict[str, str]:
    return {"estado": "ok"}

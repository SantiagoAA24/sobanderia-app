"""Errores de la API con código estable y mensaje en español para la pantalla."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ErrorApi(Exception):
    def __init__(
        self,
        estado: int,
        codigo: str,
        mensaje: str,
        cabeceras: dict[str, str] | None = None,
    ) -> None:
        super().__init__(mensaje)
        self.estado = estado
        self.codigo = codigo
        self.mensaje = mensaje
        self.cabeceras = cabeceras or {}


def no_autorizado(mensaje: str = "Debe ingresar para continuar.") -> ErrorApi:
    return ErrorApi(401, "no_autorizado", mensaje)


def sin_permiso(mensaje: str = "No tiene permiso para esto.") -> ErrorApi:
    return ErrorApi(403, "sin_permiso", mensaje)


def enlace_vencido() -> ErrorApi:
    return ErrorApi(410, "enlace_vencido", "Este enlace ya no sirve. Pida uno nuevo.")


def demasiados_intentos(segundos: int) -> ErrorApi:
    return ErrorApi(
        429,
        "demasiados_intentos",
        "Hubo muchos intentos. Espere unos minutos e intente de nuevo.",
        {"Retry-After": str(max(segundos, 1))},
    )


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(ErrorApi)
    async def _error_api(_: Request, error: ErrorApi) -> JSONResponse:
        return JSONResponse(
            {"codigo": error.codigo, "mensaje": error.mensaje},
            status_code=error.estado,
            headers=error.cabeceras,
        )

    @app.exception_handler(RequestValidationError)
    async def _validacion(_: Request, __: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            {"codigo": "validacion", "mensaje": "Revise los datos e intente de nuevo."},
            status_code=422,
        )

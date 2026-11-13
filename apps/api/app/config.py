from pydantic_settings import BaseSettings


class Ajustes(BaseSettings):
    database_url: str = "postgresql+psycopg://sobanderia:sobanderia@localhost:5432/sobanderia"
    entorno: str = "desarrollo"
    origen_web: str = "http://localhost:5173"
    proveedor_whatsapp: str = "falso"
    tz_negocio: str = "America/Bogota"


ajustes = Ajustes()

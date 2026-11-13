from pydantic_settings import BaseSettings


class Ajustes(BaseSettings):
    database_url: str = "postgresql+psycopg://sobanderia:sobanderia@localhost:5432/sobanderia"
    entorno: str = "desarrollo"
    origen_web: str = "http://localhost:5173"
    proveedor_whatsapp: str = "falso"
    tz_negocio: str = "America/Bogota"

    # Ingreso y límite de intentos fallidos
    intentos_max_correo: int = 5
    intentos_max_ip: int = 20
    ventana_intentos_min: int = 15

    # Agendamiento
    antelacion_min: int = 60  # minutos mínimos entre «ahora» y la hora que se puede agendar
    dias_agenda: int = 30  # cuántos días hacia adelante se ofrecen
    politica_version: str = "borrador-1"  # versión del texto de datos que acepta el cliente

    # Sesión: vence por inactividad y por antigüedad total
    sesion_inactividad_horas: int = 12
    sesion_maxima_dias: int = 7
    cookie_sesion: str = "sobanderia_sesion"

    # Recuperación de clave
    recuperacion_horas: int = 2
    clave_minimo: int = 8

    @property
    def cookie_segura(self) -> bool:
        return self.entorno != "desarrollo"


ajustes = Ajustes()

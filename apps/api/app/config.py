from urllib.parse import urlsplit

from pydantic import ValidationError, model_validator
from pydantic_settings import BaseSettings

ENTORNOS = ("desarrollo", "pruebas", "produccion")
# Un servidor de pruebas previo al lanzamiento también es «produccion»: así nunca arranca con
# la configuración de desarrollo.
SOLO_DESARROLLO = ("desarrollo", "pruebas")
HOSTS_LOCALES = {"localhost", "127.0.0.1", "::1"}
CREDENCIALES_DE_EJEMPLO = "sobanderia:sobanderia@"
# Proveedores de correo que de verdad envían ("falso" solo escribe en el registro).
PROVEEDORES_CORREO_REALES: frozenset[str] = frozenset({"smtp"})


def _es_local(url: str) -> bool:
    return (urlsplit(url).hostname or "") in HOSTS_LOCALES


class Ajustes(BaseSettings):
    database_url: str = "postgresql+psycopg://sobanderia:sobanderia@localhost:5432/sobanderia"
    entorno: str = "desarrollo"
    origen_web: str = "http://localhost:5173"
    proveedor_whatsapp: str = "falso"  # "falso" | "cloudapi"
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_app_secret: str = ""  # firma del webhook (X-Hub-Signature-256)
    whatsapp_verify_token: str = ""  # el que se escribe en Meta al registrar el webhook
    whatsapp_version_api: str = "v21.0"
    whatsapp_idioma: str = "es"

    # Worker: lote por vuelta, pausa entre vueltas y esperas entre intentos (minutos)
    worker_lote: int = 20
    worker_pausa_seg: int = 5
    worker_intentos_max: int = 4
    worker_esperas_min: tuple[int, ...] = (1, 5, 30)
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

    # Correo: "falso" escribe el mensaje en el registro (solo desarrollo y pruebas); "smtp" envía
    correo_proveedor: str = "falso"
    correo_desde: str = ""  # remitente, p. ej. «Sobandería <no-responder@dominio.co>»
    smtp_host: str = ""
    smtp_puerto: int = 587
    smtp_usuario: str = ""
    smtp_clave: str = ""
    smtp_starttls: bool = True

    # Límites contra el abuso de las rutas públicas
    citas_max_por_celular: int = 2  # citas agendadas por venir que puede tener un mismo celular
    reservas_max_ip: int = 20  # reservas por IP en la ventana
    ventana_reservas_min: int = 60
    enlace_max_hora: int = 3  # «Encontrar mi cita» por celular en una hora
    enlace_max_dia: int = 6  # y en un día

    # IP real detrás de un proxy: direcciones o redes (CIDR) separadas por coma ("10.0.0.0/8").
    # Vacío = no se confía en ningún encabezado X-Forwarded-For.
    proxy_confiable: str = ""

    # Limpieza de filas vencidas que hace el worker
    limpieza_cada_min: int = 60
    intentos_conservar_horas: int = 48

    def problemas(self) -> list[str]:
        """Lo que impide arrancar con esta configuración. Vacío si todo está en orden."""
        if self.entorno not in ENTORNOS:
            return [f"ENTORNO debe ser uno de {', '.join(ENTORNOS)} (recibido: «{self.entorno}»)."]
        origen_https = urlsplit(self.origen_web).scheme == "https"
        if self.entorno in SOLO_DESARROLLO:
            # Olvidar `ENTORNO=produccion` deja el valor por defecto («desarrollo») y apaga las
            # guardas: si el resto de la configuración es claramente de producción, se avisa.
            # (`cloudapi` en desarrollo es legítimo: se usa para probar con el número de Meta.)
            if self.entorno == "desarrollo" and origen_https and not _es_local(self.origen_web):
                return [
                    "ENTORNO es «desarrollo» pero ORIGEN_WEB es una dirección pública con https, "
                    "propia de producción. ¿Falta ENTORNO=produccion?"
                ]
            return []

        problemas: list[str] = []
        if CREDENCIALES_DE_EJEMPLO in self.database_url or _es_local(self.database_url):
            problemas.append(
                "DATABASE_URL es la de desarrollo (credenciales de ejemplo o servidor local)."
            )
        if not origen_https or _es_local(self.origen_web):
            problemas.append("ORIGEN_WEB debe ser la dirección pública de la app con https.")
        if self.proveedor_whatsapp != "cloudapi":
            problemas.append(
                "PROVEEDOR_WHATSAPP debe ser «cloudapi»: con «falso» ningún mensaje saldría."
            )
        else:
            faltan = [
                nombre
                for nombre, valor in (
                    ("WHATSAPP_TOKEN", self.whatsapp_token),
                    ("WHATSAPP_PHONE_NUMBER_ID", self.whatsapp_phone_number_id),
                    ("WHATSAPP_APP_SECRET", self.whatsapp_app_secret),
                    ("WHATSAPP_VERIFY_TOKEN", self.whatsapp_verify_token),
                )
                if not valor
            ]
            if faltan:
                problemas.append(f"Faltan variables de WhatsApp: {', '.join(faltan)}.")
        if self.correo_proveedor not in PROVEEDORES_CORREO_REALES:
            problemas.append(
                f"CORREO_PROVEEDOR «{self.correo_proveedor}» no envía correo real: la recuperación "
                "de clave no funcionaría. Use «smtp»."
            )
        elif self.correo_proveedor == "smtp" and not (self.smtp_host and self.correo_desde):
            problemas.append("Con CORREO_PROVEEDOR=smtp faltan SMTP_HOST y CORREO_DESDE.")
        return problemas

    @model_validator(mode="after")
    def _negarse_con_configuracion_peligrosa(self) -> "Ajustes":
        problemas = self.problemas()
        if problemas:
            raise ValueError(
                "La app no arranca con esta configuración:\n  - " + "\n  - ".join(problemas)
            )
        return self

    @property
    def cookie_segura(self) -> bool:
        return self.entorno != "desarrollo"


def _cargar() -> Ajustes:
    """Carga la configuración; si es peligrosa, sale con un mensaje claro y no con un traceback."""
    try:
        return Ajustes()
    except ValidationError as error:
        propios = [
            str(e["ctx"]["error"])
            for e in error.errors()
            if e["type"] == "value_error" and "La app no arranca" in str(e["ctx"]["error"])
        ]
        if not propios:
            raise
        raise SystemExit("\n".join(propios)) from None


ajustes = _cargar()

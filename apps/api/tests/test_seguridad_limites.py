"""Arreglos de los hallazgos de la Fase 10.2: correo SMTP, IP real, topes de reserva, límite de la
clave actual y limpieza de filas vencidas."""

import logging
import smtplib
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.requests import Request

from app import correo as modulo_correo
from app.config import ajustes
from app.correo import CorreoFalso, CorreoSmtp, obtener_enviador
from app.modelos import (
    Cita,
    EnlaceCita,
    IntentoIngreso,
    RecuperacionClave,
    Sesion,
)
from app.seguridad.ip import ip_del_cliente
from app.servicios import citas as servicio_citas
from app.servicios import mantenimiento
from app.servicios.auth import ahora as ahora_real
from tests.conftest import (
    AHORA_PRUEBA,
    CLAVE,
    CSRF,
    crear_cita,
    crear_cliente,
    crear_usuario,
    ingresar,
    sobandero_con_horario,
    sobandero_con_login,
)

DIA = "2030-01-08"


# --- H-01: correo SMTP ---------------------------------------------------------------------------


class SmtpFalso:
    """Reemplaza a smtplib.SMTP y recuerda qué se le pidió."""

    instancias: list["SmtpFalso"] = []
    fallo: Exception | None = None

    def __init__(self, host: str, puerto: int, timeout: float) -> None:
        self.host, self.puerto, self.timeout = host, puerto, timeout
        self.llamadas: list[str] = []
        self.mensaje: Any = None
        SmtpFalso.instancias.append(self)

    def __enter__(self) -> "SmtpFalso":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def starttls(self, context: object) -> None:
        self.llamadas.append("starttls")

    def login(self, usuario: str, clave: str) -> None:
        self.llamadas.append(f"login:{usuario}")

    def send_message(self, mensaje: Any) -> None:
        if SmtpFalso.fallo:
            raise SmtpFalso.fallo
        self.llamadas.append("send")
        self.mensaje = mensaje


@pytest.fixture
def smtp(monkeypatch: pytest.MonkeyPatch) -> type[SmtpFalso]:
    SmtpFalso.instancias, SmtpFalso.fallo = [], None
    monkeypatch.setattr(smtplib, "SMTP", SmtpFalso)
    monkeypatch.setattr(ajustes, "correo_proveedor", "smtp")
    monkeypatch.setattr(ajustes, "smtp_host", "smtp.ejemplo.co")
    monkeypatch.setattr(ajustes, "smtp_usuario", "usuario")
    monkeypatch.setattr(ajustes, "smtp_clave", "clave-smtp-secreta")
    monkeypatch.setattr(ajustes, "correo_desde", "Sobandería <no-responder@ejemplo.co>")
    return SmtpFalso


def test_el_correo_smtp_envia_con_tls_y_credenciales(smtp: type[SmtpFalso]) -> None:
    CorreoSmtp().enviar(
        "ana@sobanderia.test", "Recupere su clave", "Entre a https://x/restablecer/t"
    )
    servidor = smtp.instancias[0]
    assert (servidor.host, servidor.puerto) == ("smtp.ejemplo.co", 587)
    assert servidor.llamadas == ["starttls", "login:usuario", "send"]
    assert servidor.mensaje["To"] == "ana@sobanderia.test"
    assert servidor.mensaje["From"] == "Sobandería <no-responder@ejemplo.co>"
    assert servidor.mensaje["Subject"] == "Recupere su clave"
    assert "restablecer/t" in servidor.mensaje.get_content()


@pytest.mark.parametrize("error", [smtplib.SMTPException("rechazado"), OSError("sin red")])
def test_un_fallo_de_correo_no_se_propaga_ni_registra_el_cuerpo(
    smtp: type[SmtpFalso], error: Exception, caplog: pytest.LogCaptureFixture
) -> None:
    """Si fallara solo con cuentas que existen, «recuperar» delataría cuáles son."""
    smtp.fallo = error
    caplog.set_level(logging.DEBUG)
    CorreoSmtp().enviar(
        "ana@sobanderia.test", "Recupere su clave", "Entre a https://x/restablecer/T0K"
    )
    registrado = "\n".join(r.getMessage() for r in caplog.records)
    assert "no salió" in registrado and type(error).__name__ in registrado
    assert "T0K" not in registrado and "ana@" not in registrado


def test_recuperar_responde_igual_aunque_el_correo_falle(
    api: TestClient, sesion: Session, smtp: type[SmtpFalso]
) -> None:
    from app.db import obtener_sesion  # noqa: F401  (el cliente `api` ya reemplaza la base)

    crear_usuario(sesion, "existe@sobanderia.test")
    smtp.fallo = OSError("sin red")
    from app.main import app

    app.dependency_overrides.pop(obtener_enviador, None)  # usar el enviador real (SMTP con fallo)
    obtener_enviador.cache_clear()
    existe = api.post("/auth/recuperar", json={"correo": "existe@sobanderia.test"}, headers=CSRF)
    no = api.post("/auth/recuperar", json={"correo": "nadie@sobanderia.test"}, headers=CSRF)
    assert (existe.status_code, existe.json()) == (no.status_code, no.json())
    obtener_enviador.cache_clear()


def test_el_enviador_se_elige_por_configuracion(
    smtp: type[SmtpFalso], monkeypatch: pytest.MonkeyPatch
) -> None:
    obtener_enviador.cache_clear()
    assert isinstance(obtener_enviador(), CorreoSmtp)
    obtener_enviador.cache_clear()
    monkeypatch.setattr(ajustes, "correo_proveedor", "falso")
    assert isinstance(obtener_enviador(), CorreoFalso)
    obtener_enviador.cache_clear()
    assert modulo_correo.obtener_enviador is obtener_enviador


# --- H-07: la IP detrás de un proxy -------------------------------------------------------------


def pedido(directa: str | None, cabecera: str | None = None) -> Request:
    cabeceras = [(b"x-forwarded-for", cabecera.encode())] if cabecera is not None else []
    return Request(
        {
            "type": "http",
            "headers": cabeceras,
            "client": (directa, 1234) if directa else None,
        }
    )


@pytest.mark.parametrize(
    ("confiable", "directa", "cabecera", "esperada"),
    [
        (
            "",
            "10.0.0.5",
            "203.0.113.7",
            "10.0.0.5",
        ),  # sin proxy de confianza no se cree el encabezado
        ("10.0.0.5", "10.0.0.5", "203.0.113.7", "203.0.113.7"),
        ("10.0.0.0/8", "10.1.2.3", "203.0.113.7", "203.0.113.7"),
        ("10.0.0.0/8", "198.51.100.9", "203.0.113.7", "198.51.100.9"),  # lo manda alguien de afuera
        # El cliente intenta colarse una IP; el proxy añade la verdadera a la derecha.
        ("10.0.0.5", "10.0.0.5", "1.2.3.4, 203.0.113.7", "203.0.113.7"),
        # Varios proxies de confianza encadenados: la primera que no es de confianza.
        ("10.0.0.0/8", "10.0.0.9", "203.0.113.7, 10.0.0.4", "203.0.113.7"),
        ("10.0.0.5", "10.0.0.5", None, "10.0.0.5"),  # el proxy no mandó el encabezado
        ("10.0.0.5, 192.168.0.0/16", "192.168.1.1", "203.0.113.7", "203.0.113.7"),
    ],
)
def test_ip_del_cliente(
    monkeypatch: pytest.MonkeyPatch,
    confiable: str,
    directa: str,
    cabecera: str | None,
    esperada: str,
) -> None:
    monkeypatch.setattr(ajustes, "proxy_confiable", confiable)
    assert ip_del_cliente(pedido(directa, cabecera)) == esperada


def test_sin_cliente_conocido_y_con_encabezado_basura(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ajustes, "proxy_confiable", "10.0.0.5")
    assert ip_del_cliente(pedido(None)) == "desconocida"
    assert len(ip_del_cliente(pedido("10.0.0.5", "x" * 500))) <= 45


# --- H-05: topes al reservar --------------------------------------------------------------------


def reservar(api: TestClient, sobandero_id: int, hora: str, celular: str = "3205550101"):  # type: ignore[no-untyped-def]
    return api.post(
        "/publico/citas",
        json={
            "sobandero_id": sobandero_id,
            "inicio": hora,
            "nombre": "Rosa Prueba",
            "celular": celular,
            "consentimiento": True,
        },
        headers=CSRF,
    )


def libres(api: TestClient, sobandero_id: int, dia: str = DIA) -> list[str]:
    return list(
        api.get(f"/publico/sobanderos/{sobandero_id}/horas", params={"dia": dia}).json()["horas"]
    )


def test_un_celular_puede_tener_dos_citas_y_la_tercera_se_rechaza(
    api: TestClient, sesion: Session
) -> None:
    sobandero = sobandero_con_horario(sesion, 1)
    horas = libres(api, sobandero.id)
    assert [reservar(api, sobandero.id, h).status_code for h in horas[:2]] == [201, 201]
    tercera = reservar(api, sobandero.id, horas[2])
    assert tercera.status_code == 409 and tercera.json()["codigo"] == "limite_citas"
    assert "Ya tiene 2 citas agendadas" in tercera.json()["mensaje"]
    # No se creó nada: la hora sigue libre y no hay una tercera cita
    assert horas[2] in libres(api, sobandero.id)
    assert sesion.scalar(select(func.count()).select_from(Cita)) == 2


def test_otro_celular_no_se_ve_afectado_por_el_tope(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion, 1)
    horas = libres(api, sobandero.id)
    for h in horas[:2]:
        reservar(api, sobandero.id, h)
    assert reservar(api, sobandero.id, horas[2], "3119998877").status_code == 201


def test_cancelar_una_cita_libera_un_cupo(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion, 1)
    horas = libres(api, sobandero.id)
    token = reservar(api, sobandero.id, horas[0]).json()["token"]
    reservar(api, sobandero.id, horas[1])
    assert reservar(api, sobandero.id, horas[2]).status_code == 409
    assert api.post(f"/mi-cita/{token}/cancelar", headers=CSRF).status_code == 200
    assert reservar(api, sobandero.id, horas[2]).status_code == 201


def test_las_citas_pasadas_o_atendidas_no_cuentan(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion, 1)
    cliente = crear_cliente(sesion, 1)
    cliente.celular = "+573205550101"
    crear_cita(sesion, sobandero, cliente, AHORA_PRUEBA - timedelta(days=3))  # ya pasó
    crear_cita(sesion, sobandero, cliente, AHORA_PRUEBA + timedelta(days=3), estado="atendida")
    horas = libres(api, sobandero.id)
    assert [reservar(api, sobandero.id, h).status_code for h in horas[:2]] == [201, 201]


def test_el_sobandero_si_puede_agendar_mas_citas_al_mismo_cliente(
    api: TestClient, sesion: Session
) -> None:
    """El tope es contra el abuso de internet; en el local, el sobandero decide."""
    sobandero = sobandero_con_horario(sesion, 1)
    horas = [__import__("datetime").datetime.fromisoformat(h) for h in libres(api, sobandero.id)]
    for h in horas[:4]:
        servicio_citas.crear_cita(
            sesion, sobandero, "Rosa Prueba", "3205550101", h, AHORA_PRUEBA, origen="sobandero"
        )
    assert sesion.scalar(select(func.count()).select_from(Cita)) == 4


def test_el_tope_por_celular_viene_de_la_configuracion(
    api: TestClient, sesion: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ajustes, "citas_max_por_celular", 1)
    sobandero = sobandero_con_horario(sesion, 1)
    horas = libres(api, sobandero.id)
    assert reservar(api, sobandero.id, horas[0]).status_code == 201
    assert reservar(api, sobandero.id, horas[1]).status_code == 409


def test_un_mismo_lugar_no_puede_reservar_sin_limite(
    api: TestClient, sesion: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ajustes, "reservas_max_ip", 3)
    sobandero = sobandero_con_horario(sesion, 1)
    horas = libres(api, sobandero.id)
    codigos = [
        reservar(api, sobandero.id, h, f"31099900{n:02d}").status_code
        for n, h in enumerate(horas[:5])
    ]
    assert codigos == [201, 201, 201, 429, 429]
    bloqueado = reservar(api, sobandero.id, horas[5], "3109990099")
    assert int(bloqueado.headers["Retry-After"]) > 0
    assert bloqueado.json()["codigo"] == "demasiados_intentos"


def test_el_limite_de_reservas_por_ip_distingue_clientes_detras_de_un_proxy(
    api: TestClient, sesion: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ajustes, "reservas_max_ip", 1)
    monkeypatch.setattr(ajustes, "proxy_confiable", "testclient")
    sobandero = sobandero_con_horario(sesion, 1)
    horas = libres(api, sobandero.id)

    def desde(ip: str, hora: str, celular: str) -> int:
        r = api.post(
            "/publico/citas",
            json={
                "sobandero_id": sobandero.id,
                "inicio": hora,
                "nombre": "Rosa Prueba",
                "celular": celular,
                "consentimiento": True,
            },
            headers={**CSRF, "X-Forwarded-For": ip},
        )
        return r.status_code

    assert desde("203.0.113.7", horas[0], "3101110001") == 201
    assert desde("203.0.113.7", horas[1], "3101110002") == 429
    assert desde("198.51.100.9", horas[1], "3101110003") == 201


# --- H-06: la clave actual tiene límite -----------------------------------------------------------


def test_el_perfil_limita_los_intentos_de_la_clave_actual(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_login(sesion, 1)
    ingresar(api, sobandero.usuario.correo)
    codigos = [
        api.patch(
            "/yo/perfil",
            json={"correo": "nuevo@sobanderia.test", "clave_actual": f"mala-{n}"},
            headers=CSRF,
        ).status_code
        for n in range(ajustes.intentos_max_correo + 2)
    ]
    assert codigos == [401] * ajustes.intentos_max_correo + [429, 429]
    # Ni siquiera la clave correcta sirve mientras dure el bloqueo
    buena = api.patch(
        "/yo/perfil",
        json={"correo": "nuevo@sobanderia.test", "clave_actual": CLAVE},
        headers=CSRF,
    )
    assert buena.status_code == 429


def test_cambiar_clave_y_perfil_comparten_el_mismo_limite(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_login(sesion, 1)
    ingresar(api, sobandero.usuario.correo)
    for n in range(ajustes.intentos_max_correo):
        api.post(
            "/auth/cambiar-clave",
            json={"clave_actual": f"mala-{n}", "clave_nueva": "otra-clave-2"},
            headers=CSRF,
        )
    r = api.patch(
        "/yo/perfil",
        json={"correo": "nuevo@sobanderia.test", "clave_actual": CLAVE},
        headers=CSRF,
    )
    assert r.status_code == 429


def test_el_limite_de_la_clave_actual_es_por_usuario(api: TestClient, sesion: Session) -> None:
    uno = sobandero_con_login(sesion, 1)
    dos = sobandero_con_login(sesion, 2)
    ingresar(api, uno.usuario.correo)
    for n in range(ajustes.intentos_max_correo + 1):
        api.post(
            "/auth/cambiar-clave",
            json={"clave_actual": f"mala-{n}", "clave_nueva": "otra-clave-2"},
            headers=CSRF,
        )
    otro = TestClient(api.app)
    ingresar(otro, dos.usuario.correo)
    r = otro.post(
        "/auth/cambiar-clave",
        json={"clave_actual": CLAVE, "clave_nueva": "otra-clave-2"},
        headers=CSRF,
    )
    assert r.status_code == 204


def test_acertar_la_clave_borra_los_intentos_fallidos(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_login(sesion, 1)
    ingresar(api, sobandero.usuario.correo)
    for n in range(ajustes.intentos_max_correo - 1):
        api.post(
            "/auth/cambiar-clave",
            json={"clave_actual": f"mala-{n}", "clave_nueva": "otra-clave-2"},
            headers=CSRF,
        )
    ok = api.patch(
        "/yo/perfil", json={"nombre": "Nuevo Nombre"}, headers=CSRF
    )  # sin clave: no cuenta
    assert ok.status_code == 200
    bien = api.post(
        "/auth/cambiar-clave",
        json={"clave_actual": CLAVE, "clave_nueva": "otra-clave-2"},
        headers=CSRF,
    )
    assert bien.status_code == 204
    assert (
        sesion.scalar(
            select(func.count())
            .select_from(IntentoIngreso)
            .where(IntentoIngreso.tipo == "clave_actual")
        )
        == 0
    )


# --- H-09: limpieza de filas vencidas -----------------------------------------------------------


def test_purgar_borra_lo_vencido_y_deja_lo_vigente(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion, 1)
    token = reservar(api, sobandero.id, libres(api, sobandero.id)[0]).json()["token"]
    usuario = crear_usuario(sesion, "ana@sobanderia.test")
    ahora = ahora_real()
    sesion.add_all(
        [
            Sesion(usuario_id=usuario.id, token_hash="v" * 64, vence_en=ahora - timedelta(hours=1)),
            Sesion(usuario_id=usuario.id, token_hash="g" * 64, vence_en=ahora + timedelta(hours=1)),
            RecuperacionClave(
                usuario_id=usuario.id, token_hash="r" * 64, vence_en=ahora - timedelta(minutes=1)
            ),
            RecuperacionClave(
                usuario_id=usuario.id, token_hash="s" * 64, vence_en=ahora + timedelta(hours=1)
            ),
            IntentoIngreso(tipo="ingreso", correo="a", ip="1", momento=ahora - timedelta(hours=60)),
            IntentoIngreso(tipo="ingreso", correo="b", ip="1", momento=ahora - timedelta(hours=2)),
        ]
    )
    sesion.flush()
    sesion.execute(  # el enlace de la cita vence ya
        EnlaceCita.__table__.update().values(vence_en=ahora - timedelta(minutes=5))
    )

    r = mantenimiento.purgar(sesion, ahora)
    assert (r.intentos, r.sesiones, r.recuperaciones, r.enlaces) == (1, 1, 1, 1)
    assert r.total == 4
    assert sesion.scalar(select(func.count()).select_from(Sesion)) == 1
    assert sesion.scalar(select(func.count()).select_from(RecuperacionClave)) == 1
    quedan = set(sesion.scalars(select(IntentoIngreso.correo)))
    assert "a" not in quedan and "b" in quedan  # el de hace 60 h se fue; el de hace 2 h, no
    # Un enlace borrado responde igual que uno vencido o inventado
    assert api.get(f"/mi-cita/{token}").status_code == 410
    assert mantenimiento.purgar(sesion, ahora).total == 0  # repetirlo no hace daño


def test_purgar_no_toca_citas_ni_clientes(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion, 1)
    reservar(api, sobandero.id, libres(api, sobandero.id)[0])
    antes = sesion.scalar(select(func.count()).select_from(Cita))
    mantenimiento.purgar(sesion, ahora_real() + timedelta(days=400))
    assert sesion.scalar(select(func.count()).select_from(Cita)) == antes == 1

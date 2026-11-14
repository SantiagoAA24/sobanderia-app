"""Enumeración, límites de intentos, CORS, cookies, webhook, registros y hallazgos de la Fase 10.2.

Las pruebas marcadas `xfail(strict=True)` son HALLAZGOS confirmados: describen lo que debería
pasar y hoy falla. Quedan así hasta que se decida y se haga el arreglo; entonces la prueba pasa,
`strict` avisa, y se quita la marca. Los identificadores (H-01...) son los de `docs/SEGURIDAD.md`.
"""

import hashlib
import hmac
import json
import logging
import re
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import ajustes
from app.correo import CorreoFalso
from app.db import Base, obtener_sesion
from app.main import app
from app.reloj import reloj
from tests.conftest import (
    AHORA_PRUEBA,
    CLAVE,
    CSRF,
    INICIO,
    crear_cita,
    crear_cliente,
    crear_usuario,
    ingresar,
    sobandero_con_horario,
    sobandero_con_login,
)

DIA = "2030-01-08"  # martes, después de «ahora» de las pruebas
CELULAR = "3205550101"
CELULAR_E164 = "+573205550101"


def reservar(api: TestClient, sobandero_id: int, hora: str, celular: str = CELULAR):  # type: ignore[no-untyped-def]
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


def horas_del_dia(api: TestClient, sobandero_id: int) -> list[str]:
    r = api.get(f"/publico/sobanderos/{sobandero_id}/horas", params={"dia": DIA})
    assert r.status_code == 200, r.text
    return list(r.json()["horas"])


# --- Enumeración: la misma respuesta exista o no la cuenta o la cita ---------------------------


def test_ingreso_responde_igual_si_el_correo_existe_o_no(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion, "existe@sobanderia.test")
    existe = api.post(
        "/auth/ingreso",
        json={"correo": "existe@sobanderia.test", "clave": "mala-clave"},
        headers=CSRF,
    )
    no_existe = api.post(
        "/auth/ingreso",
        json={"correo": "nadie@sobanderia.test", "clave": "mala-clave"},
        headers=CSRF,
    )
    assert (existe.status_code, existe.json()) == (no_existe.status_code, no_existe.json())
    assert existe.status_code == 401


def test_ingreso_de_cuenta_inactiva_responde_igual_que_clave_mala(
    api: TestClient, sesion: Session
) -> None:
    crear_usuario(sesion, "baja@sobanderia.test", activo=False)
    crear_usuario(sesion, "activa@sobanderia.test")
    baja = api.post(
        "/auth/ingreso", json={"correo": "baja@sobanderia.test", "clave": CLAVE}, headers=CSRF
    )
    mala = api.post(
        "/auth/ingreso", json={"correo": "activa@sobanderia.test", "clave": "otra"}, headers=CSRF
    )
    assert (baja.status_code, baja.json()) == (mala.status_code, mala.json())


def test_recuperar_responde_igual_exista_o_no_el_correo(
    api: TestClient, sesion: Session, correo
) -> None:  # type: ignore[no-untyped-def]
    crear_usuario(sesion, "existe@sobanderia.test")
    crear_usuario(sesion, "baja@sobanderia.test", activo=False)
    respuestas = [
        api.post("/auth/recuperar", json={"correo": c}, headers=CSRF)
        for c in ("existe@sobanderia.test", "nadie@sobanderia.test", "baja@sobanderia.test")
    ]
    assert {(r.status_code, json.dumps(r.json())) for r in respuestas} == {
        (200, json.dumps({"mensaje": "Si el correo está registrado, le enviamos un enlace."}))
    }
    assert [d for d, _, _ in correo.enviados] == ["existe@sobanderia.test"]  # solo a la activa


def test_encontrar_mi_cita_responde_igual_exista_o_no(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion, 1)
    reservar(api, sobandero.id, horas_del_dia(api, sobandero.id)[0])
    conocido = api.post("/publico/mi-cita/enlace", json={"celular": CELULAR}, headers=CSRF)
    desconocido = api.post("/publico/mi-cita/enlace", json={"celular": "3119998877"}, headers=CSRF)
    assert (conocido.status_code, conocido.json()) == (desconocido.status_code, desconocido.json())
    assert conocido.status_code == 202


def test_un_enlace_inventado_y_uno_vencido_responden_igual(
    api: TestClient, sesion: Session
) -> None:
    sobandero = sobandero_con_horario(sesion, 1)
    token = reservar(api, sobandero.id, horas_del_dia(api, sobandero.id)[0]).json()["token"]
    app.dependency_overrides[reloj] = lambda: AHORA_PRUEBA.replace(year=2031)  # ya venció
    vencido = api.get(f"/mi-cita/{token}")
    inventado = api.get("/mi-cita/este-token-no-existe")
    assert (vencido.status_code, vencido.json()) == (inventado.status_code, inventado.json())
    assert vencido.status_code == 410


def test_ni_el_enlace_ni_las_horas_publicas_traen_el_celular(
    api: TestClient, sesion: Session
) -> None:
    sobandero = sobandero_con_horario(sesion, 1)
    creada = reservar(api, sobandero.id, horas_del_dia(api, sobandero.id)[0])
    vista = api.get(f"/mi-cita/{creada.json()['token']}")
    for cuerpo in (creada.text, vista.text, api.get("/publico/sobanderos").text):
        assert "3205550101" not in cuerpo
        assert "573205550101" not in cuerpo


# --- Límite de intentos --------------------------------------------------------------------------


def test_el_ingreso_se_bloquea_tras_cinco_fallos_aunque_luego_la_clave_sea_buena(
    api: TestClient, sesion: Session
) -> None:
    crear_usuario(sesion, "ana@sobanderia.test")
    for _ in range(ajustes.intentos_max_correo):
        assert ingresar(api, clave="mala").status_code == 401
    bloqueado = ingresar(api, clave="mala")
    assert bloqueado.status_code == 429
    assert int(bloqueado.headers["Retry-After"]) > 0
    assert ingresar(api).status_code == 429  # ni con la clave correcta mientras dure el bloqueo


def test_el_bloqueo_por_ip_vale_para_correos_distintos(api: TestClient, sesion: Session) -> None:
    for numero in range(ajustes.intentos_max_ip):
        api.post(
            "/auth/ingreso",
            json={"correo": f"x{numero}@sobanderia.test", "clave": "mala"},
            headers=CSRF,
        )
    assert (
        api.post(
            "/auth/ingreso", json={"correo": "otro@sobanderia.test", "clave": "mala"}, headers=CSRF
        ).status_code
        == 429
    )


def test_recuperar_clave_tiene_limite(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion, "ana@sobanderia.test")
    codigos = [
        api.post(
            "/auth/recuperar", json={"correo": "ana@sobanderia.test"}, headers=CSRF
        ).status_code
        for _ in range(ajustes.intentos_max_correo + 1)
    ]
    assert codigos == [200] * ajustes.intentos_max_correo + [429]


def test_encontrar_mi_cita_tiene_limite_por_celular(api: TestClient) -> None:
    codigos = [
        api.post("/publico/mi-cita/enlace", json={"celular": CELULAR}, headers=CSRF).status_code
        for _ in range(ajustes.enlace_max_hora + 1)
    ]
    assert codigos == [202] * ajustes.enlace_max_hora + [429]


def test_el_limite_de_encontrar_cita_no_guarda_el_celular(api: TestClient, sesion: Session) -> None:
    api.post("/publico/mi-cita/enlace", json={"celular": CELULAR}, headers=CSRF)
    guardado = sesion.execute(text("SELECT correo FROM intentos_ingreso")).scalars().all()
    assert guardado and all(CELULAR not in g and CELULAR_E164 not in g for g in guardado)


# --- Tokens: solo hash en la base ---------------------------------------------------------------


def tablas_que_contienen(sesion: Session, valor: str) -> set[str]:
    return {
        t.name
        for t in Base.metadata.sorted_tables
        if sesion.scalar(
            text(f'SELECT EXISTS (SELECT 1 FROM "{t.name}" x WHERE strpos(x::text, :v) > 0)'),
            {"v": valor},
        )
    }


def test_la_clave_se_guarda_con_argon2id(sesion: Session) -> None:
    usuario = crear_usuario(sesion)
    assert usuario.clave_hash.startswith("$argon2id$")
    assert CLAVE not in tablas_que_contienen(sesion, CLAVE) and not tablas_que_contienen(
        sesion, CLAVE
    )


def test_el_token_de_sesion_no_esta_en_la_base(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    ingresar(api)
    token = api.cookies.get(ajustes.cookie_sesion)
    assert token and tablas_que_contienen(sesion, token) == set()


def test_el_token_de_la_cita_solo_queda_como_hash(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_horario(sesion, 1)
    token = reservar(api, sobandero.id, horas_del_dia(api, sobandero.id)[0]).json()["token"]
    assert "enlaces_cita" not in tablas_que_contienen(sesion, token)


def test_el_token_de_la_cita_solo_esta_en_claro_en_la_bandeja(
    api: TestClient, sesion: Session
) -> None:
    """H-04, excepción aceptada: el mensaje de WhatsApp necesita el enlace completo, así que el
    token vive en `notificaciones.variables` hasta que el worker envía (o falla, o se cancela) y
    entonces se borra (`test_bandeja.py`, `test_ciclo_mensajes.py`). En ninguna otra tabla."""
    sobandero = sobandero_con_horario(sesion, 1)
    token = reservar(api, sobandero.id, horas_del_dia(api, sobandero.id)[0]).json()["token"]
    assert tablas_que_contienen(sesion, token) == {"notificaciones"}


def test_el_token_de_recuperacion_solo_queda_como_hash(
    api: TestClient, sesion: Session, correo
) -> None:  # type: ignore[no-untyped-def]
    crear_usuario(sesion)
    api.post("/auth/recuperar", json={"correo": "ana@sobanderia.test"}, headers=CSRF)
    token = re.search(r"/restablecer/([\w-]+)", correo.enviados[0][2]).group(1)  # type: ignore[union-attr]
    assert tablas_que_contienen(sesion, token) == set()


# --- CORS y cookie ------------------------------------------------------------------------------


def test_cors_no_responde_a_un_origen_ajeno(api: TestClient) -> None:
    previo = api.options(
        "/auth/ingreso",
        headers={
            "Origin": "https://malo.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-sobanderia",
        },
    )
    assert "access-control-allow-origin" not in previo.headers
    real = api.get("/salud", headers={"Origin": "https://malo.example"})
    assert "access-control-allow-origin" not in real.headers


def test_cors_permite_solo_el_dominio_de_la_app_y_con_cookies(api: TestClient) -> None:
    r = api.get("/salud", headers={"Origin": ajustes.origen_web})
    assert r.headers["access-control-allow-origin"] == ajustes.origen_web
    assert r.headers["access-control-allow-credentials"] == "true"
    previo = api.options(
        "/auth/ingreso",
        headers={
            "Origin": ajustes.origen_web,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-sobanderia",
        },
    )
    permitidos = previo.headers["access-control-allow-headers"].lower()
    assert "x-sobanderia" in permitidos and "*" not in permitidos
    assert "TRACE" not in previo.headers.get("access-control-allow-methods", "")


def test_la_cookie_de_sesion_es_httponly_samesite_y_segura_fuera_de_desarrollo(
    api: TestClient, sesion: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    crear_usuario(sesion)
    monkeypatch.setattr(ajustes, "entorno", "produccion")
    cookie = ingresar(api).headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "secure" in cookie
    assert "path=/" in cookie and "max-age=" in cookie


def test_cerrar_sesion_borra_la_cookie_y_la_fila(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    ingresar(api)
    token = api.cookies.get(ajustes.cookie_sesion)
    assert api.post("/auth/salida", headers=CSRF).status_code == 204
    api.cookies.set(ajustes.cookie_sesion, token or "")  # quien robó el token no puede reusarlo
    assert api.get("/auth/yo").status_code == 401


def test_cambiar_la_clave_cierra_las_demas_sesiones(api: TestClient, sesion: Session) -> None:
    crear_usuario(sesion)
    otro = TestClient(app)
    ingresar(api)
    ingresar(otro)
    r = api.post(
        "/auth/cambiar-clave",
        json={"clave_actual": CLAVE, "clave_nueva": "otra-clave-2"},
        headers=CSRF,
    )
    assert r.status_code == 204
    assert api.get("/auth/yo").status_code == 200
    assert otro.get("/auth/yo").status_code == 401


# --- Webhook de WhatsApp ----------------------------------------------------------------------


@pytest.fixture
def secreto(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setattr(ajustes, "whatsapp_app_secret", "secreto-de-prueba")
    monkeypatch.setattr(ajustes, "whatsapp_verify_token", "verificacion-de-prueba")
    return "secreto-de-prueba"


def firmar(cuerpo: bytes, secreto: str) -> str:
    return "sha256=" + hmac.new(secreto.encode(), cuerpo, hashlib.sha256).hexdigest()


def test_el_webhook_rechaza_sin_firma_con_firma_mala_y_sin_secreto(
    api: TestClient, secreto: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    cuerpo = b'{"entry": []}'
    assert api.post("/webhooks/whatsapp", content=cuerpo).status_code == 403
    mala = {"X-Hub-Signature-256": firmar(cuerpo, "otro-secreto")}
    assert api.post("/webhooks/whatsapp", content=cuerpo, headers=mala).status_code == 403
    buena = {"X-Hub-Signature-256": firmar(cuerpo, secreto)}
    assert api.post("/webhooks/whatsapp", content=cuerpo, headers=buena).status_code == 200
    # Cambiar el cuerpo después de firmar invalida la firma
    assert (
        api.post("/webhooks/whatsapp", content=b'{"entry": [1]}', headers=buena).status_code == 403
    )
    # Sin secreto configurado nada se acepta, ni siquiera una firma «correcta» con secreto vacío
    monkeypatch.setattr(ajustes, "whatsapp_app_secret", "")
    vacia = {"X-Hub-Signature-256": firmar(cuerpo, "")}
    assert api.post("/webhooks/whatsapp", content=cuerpo, headers=vacia).status_code == 403


def test_la_verificacion_del_webhook_exige_el_token_correcto(api: TestClient, secreto: str) -> None:
    pedido = {"hub.mode": "subscribe", "hub.challenge": "reto-123"}
    ok = api.get(
        "/webhooks/whatsapp", params={**pedido, "hub.verify_token": "verificacion-de-prueba"}
    )
    assert (ok.status_code, ok.text) == (200, "reto-123")
    assert (
        api.get("/webhooks/whatsapp", params={**pedido, "hub.verify_token": "x"}).status_code == 403
    )
    assert api.get("/webhooks/whatsapp", params=pedido).status_code == 403


def test_el_webhook_no_aparece_en_la_documentacion_publica(api: TestClient) -> None:
    assert "/webhooks/whatsapp" not in api.get("/openapi.json").json()["paths"]


# --- Registros: sin celulares completos ni tokens ---------------------------------------------


@pytest.fixture
def api_con_correo_real(sesion: Session) -> Iterator[TestClient]:
    """Como `api`, pero con el enviador de correo de verdad (el que escribe en el registro)."""
    app.dependency_overrides[obtener_sesion] = lambda: sesion
    app.dependency_overrides[reloj] = lambda: AHORA_PRUEBA
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_los_registros_no_traen_celulares_completos_ni_tokens_de_cita(
    api: TestClient, sesion: Session, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    sobandero = sobandero_con_login(sesion, 1)
    token = reservar(api, sobandero.id, horas_del_dia(api, sobandero.id)[0]).json()["token"]
    assert api.get(f"/mi-cita/{token}").status_code == 200
    assert api.post(f"/mi-cita/{token}/cancelar", headers=CSRF).status_code == 200
    reservar(api, sobandero.id, horas_del_dia(api, sobandero.id)[1])
    api.post("/publico/mi-cita/enlace", json={"celular": CELULAR}, headers=CSRF)
    ingresar(api, sobandero.usuario.correo)
    cookie = api.cookies.get(ajustes.cookie_sesion) or "sin-cookie"

    # Solo los registros de la app: el cliente HTTP de la prueba escribe sus propias URL.
    propios = [r for r in caplog.records if r.name.startswith("sobanderia")]
    registrado = "\n".join(r.getMessage() for r in propios)
    assert registrado, "la prueba no capturó ningún registro"
    assert not re.search(r"3205550101|573205550101", registrado)
    assert token not in registrado and cookie not in registrado
    assert CLAVE not in registrado


def test_el_registro_de_produccion_no_trae_el_enlace_de_recuperacion(
    api_con_correo_real: TestClient,
    sesion: Session,
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """H-01: fuera de desarrollo y pruebas, el correo falso no escribe el cuerpo en el registro."""
    monkeypatch.setattr(ajustes, "entorno", "produccion")
    caplog.set_level(logging.DEBUG)
    crear_usuario(sesion)
    api_con_correo_real.post(
        "/auth/recuperar", json={"correo": "ana@sobanderia.test"}, headers=CSRF
    )
    registrado = "\n".join(r.getMessage() for r in caplog.records)
    assert "/restablecer/" not in registrado and "a***@sobanderia.test" in registrado


def test_en_desarrollo_el_correo_falso_si_deja_el_enlace_para_poder_abrirlo(
    api_con_correo_real: TestClient, sesion: Session, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    crear_usuario(sesion)
    api_con_correo_real.post(
        "/auth/recuperar", json={"correo": "ana@sobanderia.test"}, headers=CSRF
    )
    assert "/restablecer/" in "\n".join(r.getMessage() for r in caplog.records)


def test_el_correo_falso_enmascara_el_destino(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO)
    CorreoFalso().enviar("ana.perez@sobanderia.test", "Asunto", "cuerpo")
    assert "ana.perez" not in caplog.text and "a***@sobanderia.test" in caplog.text


def test_los_errores_de_validacion_no_devuelven_lo_que_se_escribio(api: TestClient) -> None:
    r = api.post(
        "/publico/citas",
        json={"sobandero_id": "x", "inicio": "no-es-fecha", "nombre": "N", "celular": CELULAR},
        headers=CSRF,
    )
    assert r.status_code == 422
    assert r.json() == {"codigo": "validacion", "mensaje": "Revise los datos e intente de nuevo."}


# --- HALLAZGOS: lo que hoy falla y debería pasar -----------------------------------------------


def test_la_api_envia_cabeceras_de_seguridad(api: TestClient) -> None:
    r = api.get("/salud")
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("referrer-policy")
    assert "frame-ancestors" in r.headers.get("content-security-policy", "")


def test_las_respuestas_con_sesion_no_se_guardan_en_cache(api: TestClient, sesion: Session) -> None:
    sobandero_con_login(sesion, 1)
    ingresar(api, "sobandero1@sobanderia.test")
    assert "no-store" in api.get("/yo/citas").headers.get("cache-control", "")
    assert "no-store" in api.get("/auth/yo").headers.get("cache-control", "")


def test_la_documentacion_de_la_api_se_cierra_fuera_de_desarrollo() -> None:
    """H-03."""
    from app.main import crear_app

    for entorno in ("produccion",):
        cerrada = TestClient(crear_app(entorno))
        for ruta in ("/docs", "/redoc", "/openapi.json"):
            assert cerrada.get(ruta).status_code == 404, (entorno, ruta)
        assert cerrada.get("/salud").status_code == 200
    for entorno in ("desarrollo", "pruebas"):
        abierta = TestClient(crear_app(entorno))
        assert abierta.get("/openapi.json").status_code == 200
        assert "content-security-policy" not in abierta.get("/docs").headers  # carga scripts
    # El contrato del cliente de la web se escribe sin HTTP, aun con la documentación cerrada.
    assert "paths" in crear_app("produccion").openapi()


def test_un_mismo_celular_no_puede_reservar_sin_limite(api: TestClient, sesion: Session) -> None:
    """El tope exacto es decisión de negocio; aquí se exige solo que exista alguno <= 20."""
    sobandero = sobandero_con_horario(sesion, 1)
    libres = horas_del_dia(api, sobandero.id)
    codigos = [reservar(api, sobandero.id, hora).status_code for hora in libres[:20]]
    assert any(c in (409, 429) for c in codigos), f"las {len(codigos)} reservas se aceptaron"


def test_pedir_el_enlace_rota_el_anterior_pero_solo_unas_pocas_veces_por_hora(
    api: TestClient, sesion: Session
) -> None:
    """H-08, riesgo reducido: rotar el enlace permite reenviarlo con solo el hash guardado.
    Un tercero que conozca el celular puede invalidarlo, pero `enlace_max_hora` veces por hora."""
    sobandero = sobandero_con_horario(sesion, 1)
    token = reservar(api, sobandero.id, horas_del_dia(api, sobandero.id)[0]).json()["token"]
    tercero = TestClient(app)
    codigos = [
        tercero.post("/publico/mi-cita/enlace", json={"celular": CELULAR}, headers=CSRF).status_code
        for _ in range(ajustes.enlace_max_hora + 2)
    ]
    assert codigos == [202] * ajustes.enlace_max_hora + [429, 429]
    assert api.get(f"/mi-cita/{token}").status_code == 410  # el enlace viejo ya no sirve


def test_encontrar_mi_cita_tambien_tiene_tope_diario(api: TestClient, sesion: Session) -> None:
    """Seis por día por celular, aunque estén repartidas en horas distintas."""
    from datetime import timedelta

    from app.modelos import IntentoIngreso
    from app.seguridad.tokens import hash_token
    from app.servicios.auth import ahora as ahora_real

    huella = hash_token(CELULAR_E164)
    for n in range(ajustes.enlace_max_dia):
        sesion.add(
            IntentoIngreso(
                tipo="enlace",
                correo=huella,
                ip=f"198.51.100.{n}",
                momento=ahora_real() - timedelta(hours=3 + n),  # fuera de la última hora
            )
        )
    sesion.flush()
    r = api.post("/publico/mi-cita/enlace", json={"celular": CELULAR}, headers=CSRF)
    assert r.status_code == 429


def test_cambiar_clave_limita_los_intentos_de_la_clave_actual(
    api: TestClient, sesion: Session
) -> None:
    crear_usuario(sesion)
    ingresar(api)
    codigos = [
        api.post(
            "/auth/cambiar-clave",
            json={"clave_actual": f"mala-{i}", "clave_nueva": "otra-clave-2"},
            headers=CSRF,
        ).status_code
        for i in range(ajustes.intentos_max_correo + 3)
    ]
    assert 429 in codigos, codigos


def fallar_veinte_veces(api: TestClient, xff: str) -> None:
    for numero in range(ajustes.intentos_max_ip):
        api.post(
            "/auth/ingreso",
            json={"correo": f"x{numero}@sobanderia.test", "clave": "mala"},
            headers={**CSRF, "X-Forwarded-For": xff},
        )


def ingresar_mal(api: TestClient, xff: str) -> int:
    return api.post(
        "/auth/ingreso",
        json={"correo": "otro@sobanderia.test", "clave": "mala"},
        headers={**CSRF, "X-Forwarded-For": xff},
    ).status_code


def test_detras_de_un_proxy_de_confianza_cada_cliente_tiene_su_ip(
    api: TestClient, sesion: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """H-07: con PROXY_CONFIABLE, los fallos de una persona no bloquean a las demás."""
    monkeypatch.setattr(ajustes, "proxy_confiable", "testclient")  # el «proxy» de esta prueba
    fallar_veinte_veces(api, "203.0.113.7")
    assert ingresar_mal(api, "203.0.113.7") == 429  # la misma persona sí queda bloqueada
    assert ingresar_mal(api, "198.51.100.9") == 401  # otra no


def test_sin_proxy_de_confianza_el_encabezado_no_se_cree(api: TestClient, sesion: Session) -> None:
    """Nadie puede cambiar de IP inventando X-Forwarded-For para esquivar el límite."""
    fallar_veinte_veces(api, "203.0.113.7")
    assert ingresar_mal(api, "198.51.100.9") == 429


def test_hay_un_cita_y_cliente_para_las_pruebas_de_hallazgos(sesion: Session) -> None:
    """Guarda de cordura: los ayudantes siguen sirviendo para armar estos escenarios."""
    sobandero = sobandero_con_horario(sesion, 1)
    assert crear_cita(sesion, sobandero, crear_cliente(sesion, 1), INICIO).id

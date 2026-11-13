"""Admin-Mensajes (API): ver la bandeja, reenviar fallidas y el aviso en el Resumen."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modelos import Auditoria, Cita, EnlaceCita, Notificacion
from app.seguridad.tokens import hash_token
from app.servicios import bandeja
from app.whatsapp import Falso
from tests.conftest import (
    AHORA_PRUEBA,
    CSRF,
    crear_cita,
    crear_cliente,
    crear_sobandero,
    ingresar,
    sobandero_con_login,
)
from tests.test_admin_sobanderos import entrar_admin

VARIABLES = {"nombre": "Cliente 1", "sobandero": "Sobandero 1", "dia": "x", "hora": "y"}


def _fila(
    sesion: Session,
    cita: Cita,
    estado: str = "fallida",
    plantilla: str = "cita_cancelada",
    tipo: str = "cancelacion",
    **campos: object,
) -> Notificacion:
    fila = Notificacion(
        cita_id=cita.id,
        tipo=tipo,
        plantilla=plantilla,
        variables=dict(VARIABLES),
        enviar_en=AHORA_PRUEBA,
        estado=estado,
        intentos=4 if estado == "fallida" else 1,
        ultimo_error="Meta respondió 503" if estado == "fallida" else None,
        **campos,
    )
    sesion.add(fila)
    sesion.flush()
    return fila


@pytest.fixture
def cita(sesion: Session) -> Cita:
    return crear_cita(sesion, crear_sobandero(sesion, 1), crear_cliente(sesion))


# --- Permisos ---------------------------------------------------------------------------


def test_exige_ingresar(api: TestClient) -> None:
    assert api.get("/admin/mensajes").status_code == 401
    assert api.post("/admin/mensajes/1/reenviar", headers=CSRF).status_code == 401


def test_un_sobandero_no_puede_ver_ni_reenviar(api: TestClient, sesion: Session) -> None:
    sobandero = sobandero_con_login(sesion, 1)
    assert ingresar(api, sobandero.usuario.correo).status_code == 200
    assert api.get("/admin/mensajes").status_code == 403
    assert api.post("/admin/mensajes/1/reenviar", headers=CSRF).status_code == 403


def test_reenviar_exige_la_cabecera_csrf(api: TestClient, sesion: Session, cita: Cita) -> None:
    entrar_admin(api, sesion)
    fila = _fila(sesion, cita)
    assert api.post(f"/admin/mensajes/{fila.id}/reenviar").status_code == 403


# --- Listado ----------------------------------------------------------------------------


def test_lista_con_celular_enmascarado_y_sin_token(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    entrar_admin(api, sesion)
    _fila(sesion, cita, "enviada", "cita_confirmada", "confirmacion")
    sesion.flush()
    respuesta = api.get("/admin/mensajes")
    assert respuesta.status_code == 200
    (fila,) = respuesta.json()
    assert fila["cliente_nombre"] == "Cliente 1"
    assert fila["celular"] == "300 *** 0001"
    assert fila["plantilla"] == "cita_confirmada"
    assert "+573000000001" not in respuesta.text and "token" not in respuesta.text


def test_filtra_por_estado_y_lo_mas_reciente_primero(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    entrar_admin(api, sesion)
    vieja = _fila(sesion, cita, "fallida")
    nueva = _fila(sesion, cita, "fallida")
    _fila(sesion, cita, "enviada")
    fallidas = api.get("/admin/mensajes", params={"estado": "fallida"}).json()
    assert [f["id"] for f in fallidas] == [nueva.id, vieja.id]
    assert len(api.get("/admin/mensajes").json()) == 3
    assert api.get("/admin/mensajes", params={"estado": "rara"}).status_code == 422


def test_pagina_con_antes(api: TestClient, sesion: Session, cita: Cita) -> None:
    entrar_admin(api, sesion)
    filas = [_fila(sesion, cita) for _ in range(3)]
    primera = api.get("/admin/mensajes", params={"limite": 2}).json()
    assert [f["id"] for f in primera] == [filas[2].id, filas[1].id]
    resto = api.get("/admin/mensajes", params={"limite": 2, "antes": primera[-1]["id"]}).json()
    assert [f["id"] for f in resto] == [filas[0].id]


# --- Reenviar ---------------------------------------------------------------------------


def test_reenviar_deja_la_fila_pendiente_con_cuenta_nueva_y_queda_en_la_actividad(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    admin = entrar_admin(api, sesion)
    fila = _fila(sesion, cita)
    respuesta = api.post(f"/admin/mensajes/{fila.id}/reenviar", headers=CSRF)
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "pendiente"
    sesion.refresh(fila)
    assert (fila.estado, fila.intentos, fila.ultimo_error) == ("pendiente", 0, None)
    registro = sesion.scalars(
        select(Auditoria).where(Auditoria.accion == "mensaje_reenviado")
    ).one()
    assert registro.usuario_id == admin.id and registro.entidad_id == fila.id
    assert "300" not in str(registro.detalle)
    actividad = api.get("/admin/actividad").json()
    assert actividad[0]["texto"] == "Reenvió un mensaje que no había salido."

    # Y el worker lo envía la próxima vuelta.
    proveedor = Falso()
    assert bandeja.vaciar(sesion, proveedor, AHORA_PRUEBA + timedelta(minutes=1)) == 1
    sesion.refresh(fila)
    assert fila.estado == "enviada"


def test_reenviar_con_enlace_rota_el_enlace_y_pone_el_token_nuevo(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    entrar_admin(api, sesion)
    sesion.add(EnlaceCita(cita_id=cita.id, token_hash=hash_token("viejo"), vence_en=cita.inicio))
    fila = _fila(sesion, cita, plantilla="cita_confirmada", tipo="confirmacion")
    assert "token" not in fila.variables  # el worker lo borró al agotar los intentos
    assert api.post(f"/admin/mensajes/{fila.id}/reenviar", headers=CSRF).status_code == 200
    sesion.refresh(fila)
    token = fila.variables["token"]
    assert api.get(f"/mi-cita/{token}").status_code == 200
    assert api.get("/mi-cita/viejo").status_code == 410
    proveedor = Falso()
    bandeja.vaciar(sesion, proveedor, AHORA_PRUEBA + timedelta(minutes=1))
    assert proveedor.enviados[0].codigo_enlace == token
    sesion.refresh(fila)
    assert "token" not in fila.variables


@pytest.mark.parametrize("estado", ["pendiente", "enviada", "cancelada"])
def test_solo_se_reenvian_las_fallidas(
    api: TestClient, sesion: Session, cita: Cita, estado: str
) -> None:
    entrar_admin(api, sesion)
    fila = _fila(sesion, cita, estado)
    respuesta = api.post(f"/admin/mensajes/{fila.id}/reenviar", headers=CSRF)
    assert respuesta.status_code == 409
    assert respuesta.json()["codigo"] == "mensaje_no_reenviable"


def test_no_reenvia_si_la_cita_ya_no_esta_agendada(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    entrar_admin(api, sesion)
    cita.estado = "atendida"
    fila = _fila(sesion, cita, plantilla="recordatorio_cita", tipo="recordatorio")
    respuesta = api.post(f"/admin/mensajes/{fila.id}/reenviar", headers=CSRF)
    assert respuesta.status_code == 409
    assert respuesta.json()["codigo"] == "mensaje_no_reenviable"


def test_el_aviso_de_cancelacion_se_reenvia_aunque_la_cita_este_cancelada(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    entrar_admin(api, sesion)
    cita.estado = "cancelada"
    fila = _fila(sesion, cita)
    assert api.post(f"/admin/mensajes/{fila.id}/reenviar", headers=CSRF).status_code == 200


def test_reenviar_mensaje_inexistente_da_404(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    assert api.post("/admin/mensajes/9999/reenviar", headers=CSRF).status_code == 404


# --- Aviso en el Resumen ----------------------------------------------------------------


def test_el_resumen_cuenta_los_mensajes_fallidos(
    api: TestClient, sesion: Session, cita: Cita
) -> None:
    entrar_admin(api, sesion)
    assert api.get("/admin/resumen").json()["mensajes_fallidos"] == 0
    _fila(sesion, cita, "fallida")
    _fila(sesion, cita, "fallida")
    _fila(sesion, cita, "enviada")
    assert api.get("/admin/resumen").json()["mensajes_fallidos"] == 2

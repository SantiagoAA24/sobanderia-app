"""Dar de baja a un sobandero: dejar las citas próximas o cancelarlas con aviso."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modelos import Auditoria, Cita, Notificacion, Sesion
from tests.conftest import (
    AHORA_PRUEBA,
    CSRF,
    INICIO,
    crear_cita,
    crear_cliente,
    ingresar,
    sobandero_con_login,
)
from tests.test_admin_sobanderos import entrar_admin

PASADA = AHORA_PRUEBA - timedelta(days=1)


def con_citas(sesion: Session, numero: int = 1):  # type: ignore[no-untyped-def]
    """Un sobandero con dos citas próximas, una cancelada, una atendida y una pasada."""
    sobandero = sobandero_con_login(sesion, numero)
    proximas = [
        crear_cita(sesion, sobandero, crear_cliente(sesion, 1), INICIO),
        crear_cita(sesion, sobandero, crear_cliente(sesion, 2), INICIO + timedelta(days=1)),
    ]
    crear_cita(
        sesion, sobandero, crear_cliente(sesion, 3), INICIO + timedelta(days=2), estado="cancelada"
    )
    crear_cita(sesion, sobandero, crear_cliente(sesion, 4), PASADA, estado="atendida")
    return sobandero, proximas


def baja(api: TestClient, id_: int, citas: str):  # type: ignore[no-untyped-def]
    return api.post(f"/admin/sobanderos/{id_}/baja", json={"citas": citas}, headers=CSRF)


def test_la_ficha_cuenta_las_citas_proximas(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    sobandero, _ = con_citas(sesion)
    assert api.get(f"/admin/sobanderos/{sobandero.id}").json()["citas_proximas"] == 2


def test_cancelar_y_avisar_cancela_las_proximas_avisa_y_cierra_sesiones(
    api: TestClient, sesion: Session
) -> None:
    entrar_admin(api, sesion)
    sobandero, proximas = con_citas(sesion)
    # Una sesión abierta del sobandero (otro dispositivo).
    otro = TestClient(api.app)
    assert ingresar(otro, sobandero.usuario.correo).status_code == 200
    assert otro.get("/yo/citas").status_code == 200

    r = baja(api, sobandero.id, "cancelar")
    assert r.status_code == 200
    assert r.json()["citas_canceladas"] == 2
    assert r.json()["sobandero"]["activo"] is False

    for cita in proximas:
        sesion.refresh(cita)
        assert (cita.estado, cita.cancelada_por) == ("cancelada", "admin")
    notificaciones = sesion.scalars(
        select(Notificacion).where(
            Notificacion.cita_id.in_([c.id for c in proximas]), Notificacion.tipo == "cancelacion"
        )
    ).all()
    assert len(notificaciones) == 2
    assert {n.plantilla for n in notificaciones} == {"cita_cancelada_sobandero"}
    assert {n.estado for n in notificaciones} == {"pendiente"}

    # Sin recordatorios vivos para esas citas.
    vivos = sesion.scalars(
        select(Notificacion).where(
            Notificacion.cita_id.in_([c.id for c in proximas]),
            Notificacion.tipo == "recordatorio",
            Notificacion.estado == "pendiente",
        )
    ).all()
    assert vivos == []

    # Sesión cerrada al instante y no puede volver a entrar.
    assert otro.get("/yo/citas").status_code == 401
    assert ingresar(otro, sobandero.usuario.correo).status_code == 401
    assert (
        sesion.scalars(select(Sesion).where(Sesion.usuario_id == sobandero.usuario_id)).all() == []
    )


def test_cancelar_y_avisar_conserva_el_historial(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    sobandero, _ = con_citas(sesion)
    baja(api, sobandero.id, "cancelar")
    estados = sorted(
        c.estado for c in sesion.scalars(select(Cita).where(Cita.sobandero_id == sobandero.id))
    )
    assert estados == ["atendida", "cancelada", "cancelada", "cancelada"]
    assert sesion.get(type(sobandero), sobandero.id) is not None  # la fila no se borra


def test_la_hora_cancelada_queda_libre_y_el_sobandero_deja_de_ofrecerse(
    api: TestClient, sesion: Session
) -> None:
    entrar_admin(api, sesion)
    sobandero, _ = con_citas(sesion)
    baja(api, sobandero.id, "cancelar")
    publico = TestClient(api.app)
    assert sobandero.id not in [s["id"] for s in publico.get("/publico/sobanderos").json()]
    assert publico.get(f"/publico/sobanderos/{sobandero.id}/dias").status_code == 404


def test_dejarlas_como_estan_no_cancela_ni_avisa_y_deja_atender(
    api: TestClient, sesion: Session
) -> None:
    entrar_admin(api, sesion)
    sobandero, proximas = con_citas(sesion)
    antes = len(sesion.scalars(select(Notificacion)).all())
    sesion_sobandero = TestClient(api.app)
    ingresar(sesion_sobandero, sobandero.usuario.correo)

    r = baja(api, sobandero.id, "dejar")
    assert r.status_code == 200 and r.json()["citas_canceladas"] == 0
    assert r.json()["sobandero"]["activo"] is True  # todavía atiende lo que le queda
    assert r.json()["sobandero"]["recibe_citas"] is False
    assert r.json()["sobandero"]["baja_en"] is not None
    assert len(sesion.scalars(select(Notificacion)).all()) == antes
    for cita in proximas:
        sesion.refresh(cita)
        assert cita.estado == "agendada"

    # Ya no recibe citas nuevas.
    publico = TestClient(api.app)
    assert sobandero.id not in [s["id"] for s in publico.get("/publico/sobanderos").json()]
    # Y puede seguir atendiendo.
    assert sesion_sobandero.get("/yo/citas").status_code == 200


def test_al_cerrar_su_ultima_cita_la_cuenta_se_desactiva_sola(
    api: TestClient, sesion: Session
) -> None:
    entrar_admin(api, sesion)
    sobandero, proximas = con_citas(sesion)
    propio = TestClient(api.app)
    ingresar(propio, sobandero.usuario.correo)
    baja(api, sobandero.id, "dejar")

    primera = propio.patch(f"/yo/citas/{proximas[0].id}", json={"estado": "atendida"}, headers=CSRF)
    assert primera.status_code == 200
    assert propio.get("/yo/citas").status_code == 200  # aún le queda una

    segunda = propio.patch(
        f"/yo/citas/{proximas[1].id}", json={"estado": "no_asistio"}, headers=CSRF
    )
    assert segunda.status_code == 200
    sesion.refresh(sobandero.usuario)
    assert sobandero.usuario.activo is False
    assert propio.get("/yo/citas").status_code == 401
    assert ingresar(propio, sobandero.usuario.correo).status_code == 401
    acciones = [a.accion for a in sesion.scalars(select(Auditoria).order_by(Auditoria.id))]
    assert acciones[-1] == "baja_completada"


def test_si_el_cliente_cancela_la_ultima_cita_tambien_se_completa_la_baja(
    api: TestClient, sesion: Session
) -> None:
    entrar_admin(api, sesion)
    sobandero, proximas = con_citas(sesion)
    baja(api, sobandero.id, "dejar")
    cliente = TestClient(api.app)
    # Cancela el sobandero la primera y el cliente la segunda, por su enlace.
    from app.modelos import EnlaceCita
    from app.seguridad.tokens import generar_token, hash_token

    token = generar_token()
    sesion.add(
        EnlaceCita(
            cita_id=proximas[1].id,
            token_hash=hash_token(token),
            vence_en=INICIO + timedelta(days=5),
        )
    )
    sesion.flush()
    propio = TestClient(api.app)
    ingresar(propio, sobandero.usuario.correo)
    propio.patch(f"/yo/citas/{proximas[0].id}", json={"estado": "cancelada"}, headers=CSRF)
    assert cliente.post(f"/mi-cita/{token}/cancelar", headers=CSRF).status_code == 200
    sesion.refresh(sobandero.usuario)
    assert sobandero.usuario.activo is False


def test_dejarlas_sin_citas_pendientes_desactiva_en_el_acto(
    api: TestClient, sesion: Session
) -> None:
    entrar_admin(api, sesion)
    sobandero = sobandero_con_login(sesion, 1)
    r = baja(api, sobandero.id, "dejar")
    assert r.status_code == 200 and r.json()["sobandero"]["activo"] is False


def test_se_puede_pasar_de_dejar_a_cancelar(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    sobandero, proximas = con_citas(sesion)
    baja(api, sobandero.id, "dejar")
    r = baja(api, sobandero.id, "cancelar")
    assert r.status_code == 200 and r.json()["citas_canceladas"] == 2
    assert r.json()["sobandero"]["activo"] is False


def test_baja_invalida(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    sobandero, _ = con_citas(sesion)
    assert baja(api, sobandero.id, "borrar").status_code == 422
    assert baja(api, 99999, "dejar").status_code == 404
    baja(api, sobandero.id, "cancelar")
    otra_vez = baja(api, sobandero.id, "cancelar")
    assert (otra_vez.status_code, otra_vez.json()["codigo"]) == (409, "ya_dado_de_baja")


def test_la_baja_es_atomica_si_algo_falla_no_queda_a_medias(
    api: TestClient, sesion: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.servicios import notificaciones

    entrar_admin(api, sesion)
    sobandero, proximas = con_citas(sesion)
    sesion.commit()  # lo creado hasta aquí sobrevive al rollback de la baja
    original = notificaciones.encolar
    llamadas = {"n": 0}

    def falla_en_la_segunda(*args, **kwargs):  # type: ignore[no-untyped-def]
        llamadas["n"] += 1
        if llamadas["n"] == 2:
            raise RuntimeError("falla simulada")
        return original(*args, **kwargs)

    monkeypatch.setattr(notificaciones, "encolar", falla_en_la_segunda)
    cliente = TestClient(api.app, raise_server_exceptions=False)
    cliente.cookies.update(api.cookies)
    assert baja(cliente, sobandero.id, "cancelar").status_code == 500
    sesion.expire_all()
    for cita in proximas:
        assert cita.estado == "agendada"
    assert sobandero.usuario.activo is True


def test_la_baja_deja_su_rastro(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    sobandero, _ = con_citas(sesion)
    baja(api, sobandero.id, "cancelar")
    fila = sesion.scalars(select(Auditoria).where(Auditoria.accion == "baja_cancelar")).one()
    assert fila.entidad_id == sobandero.id
    assert fila.detalle == {"sobandero": sobandero.usuario.nombre, "citas_canceladas": 2}

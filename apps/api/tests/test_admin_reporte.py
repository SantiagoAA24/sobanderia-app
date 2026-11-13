"""Resumen semanal: atendidas, no asistidas y canceladas, en total y por sobandero."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import INICIO, crear_cita, crear_cliente, sobandero_con_login
from tests.test_admin_sobanderos import entrar_admin

# INICIO es el lunes 7 de enero de 2030 (10:00 en Bogotá): la semana va del 7 al 13.


def cita(sesion: Session, sobandero, n: int, dias: int, estado: str, horas: int = 0):  # type: ignore[no-untyped-def]
    return crear_cita(
        sesion,
        sobandero,
        crear_cliente(sesion, n),
        INICIO + timedelta(days=dias, hours=horas),
        estado=estado,
    )


def test_cuenta_por_estado_en_total_y_por_sobandero(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    marcela = sobandero_con_login(sesion, 2)
    cita(sesion, carlos, 1, 0, "atendida")
    cita(sesion, carlos, 2, 1, "atendida")
    cita(sesion, carlos, 3, 2, "no_asistio")
    cita(sesion, carlos, 4, 3, "cancelada")
    cita(sesion, marcela, 5, 0, "atendida", horas=1)
    cita(sesion, marcela, 6, 6, "cancelada")  # domingo: todavía es esa semana
    cita(sesion, marcela, 7, 3, "agendada")  # pendiente: no cuenta en ninguna

    r = api.get("/admin/reporte", params={"semana": "2030-01-09"})  # un miércoles cualquiera
    assert r.status_code == 200
    cuerpo = r.json()
    assert (cuerpo["desde"], cuerpo["hasta"]) == ("2030-01-07", "2030-01-13")
    assert (cuerpo["atendidas"], cuerpo["no_asistieron"], cuerpo["canceladas"]) == (3, 1, 2)
    por = {s["nombre"]: s for s in cuerpo["por_sobandero"]}
    assert (
        por[carlos.usuario.nombre]["atendidas"],
        por[carlos.usuario.nombre]["no_asistieron"],
    ) == (2, 1)
    assert por[carlos.usuario.nombre]["canceladas"] == 1
    assert (
        por[marcela.usuario.nombre]["atendidas"],
        por[marcela.usuario.nombre]["no_asistieron"],
    ) == (1, 0)
    assert por[marcela.usuario.nombre]["canceladas"] == 1


def test_solo_cuenta_la_semana_pedida(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    carlos = sobandero_con_login(sesion, 1)
    cita(sesion, carlos, 1, -1, "atendida")  # domingo anterior
    cita(sesion, carlos, 2, 0, "atendida")
    cita(sesion, carlos, 3, 7, "atendida")  # lunes siguiente
    cuerpo = api.get("/admin/reporte", params={"semana": "2030-01-07"}).json()
    assert cuerpo["atendidas"] == 1
    # Sin parámetro es la semana de «hoy» (martes 1 de enero de 2030).
    por_defecto = api.get("/admin/reporte").json()
    assert (por_defecto["desde"], por_defecto["hasta"]) == ("2029-12-31", "2030-01-06")


def test_incluye_a_quien_se_dio_de_baja_si_tuvo_citas_esa_semana(
    api: TestClient, sesion: Session
) -> None:
    entrar_admin(api, sesion)
    activo = sobandero_con_login(sesion, 1)
    de_baja = sobandero_con_login(sesion, 2)
    de_baja.usuario.activo = False
    sin_citas_de_baja = sobandero_con_login(sesion, 3)
    sin_citas_de_baja.usuario.activo = False
    cita(sesion, de_baja, 1, 0, "atendida")
    sesion.flush()
    nombres = [
        s["nombre"]
        for s in api.get("/admin/reporte", params={"semana": "2030-01-07"}).json()["por_sobandero"]
    ]
    assert nombres == [activo.usuario.nombre, de_baja.usuario.nombre]


def test_semana_sin_citas_da_ceros(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    sobandero_con_login(sesion, 1)
    cuerpo = api.get("/admin/reporte", params={"semana": "2030-01-07"}).json()
    assert (cuerpo["atendidas"], cuerpo["no_asistieron"], cuerpo["canceladas"]) == (0, 0, 0)
    assert cuerpo["por_sobandero"][0]["atendidas"] == 0


def test_no_expone_clientes_ni_celulares(api: TestClient, sesion: Session) -> None:
    entrar_admin(api, sesion)
    cita(sesion, sobandero_con_login(sesion, 1), 1, 0, "atendida")
    texto = api.get("/admin/reporte", params={"semana": "2030-01-07"}).text
    assert "+57" not in texto and "Cliente" not in texto

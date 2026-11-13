"""Horas libres, horario semanal y bloqueos del sobandero."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modelos import Bloqueo, Horario
from tests.conftest import (
    CSRF,
    INICIO,
    crear_cita,
    crear_cliente,
    crear_usuario,
    ingresar,
    rango,
    sobandero_con_login,
)

LUNES = "2030-01-07"


def entrar(api: TestClient, sesion: Session, numero: int = 1):  # type: ignore[no-untyped-def]
    sobandero = sobandero_con_login(sesion, numero)
    assert ingresar(api, sobandero.usuario.correo).status_code == 200
    return sobandero


def test_rutas_exigen_sesion_y_perfil_de_sobandero(api: TestClient, sesion: Session) -> None:
    rutas = ["/yo/dias", f"/yo/horas?dia={LUNES}", "/yo/horario", "/yo/bloqueos"]
    for ruta in rutas:
        assert api.get(ruta).status_code == 401
    assert api.put("/yo/horario", json={"dias": []}, headers=CSRF).status_code == 401
    assert api.post("/yo/bloqueos", json={}, headers=CSRF).status_code == 401
    assert api.delete("/yo/bloqueos/1", headers=CSRF).status_code == 401

    crear_usuario(sesion, "admin@sobanderia.test", rol="admin")
    ingresar(api, "admin@sobanderia.test")
    for ruta in rutas:
        assert api.get(ruta).status_code == 403


def test_horas_libres_sin_antelacion_y_con_la_cita_excluida(
    api: TestClient, sesion: Session
) -> None:
    yo = entrar(api, sesion)
    cita = crear_cita(sesion, yo, crear_cliente(sesion), INICIO)  # lunes 10:00 Bogotá
    horas = api.get("/yo/horas", params={"dia": LUNES}).json()
    assert horas["duracion_min"] == 30
    assert "2030-01-07T15:00:00Z" not in horas["horas"]
    assert "2030-01-07T13:00:00Z" in horas["horas"]  # 8:00 a. m.

    cambiando = api.get("/yo/horas", params={"dia": LUNES, "excluir_cita": cita.id}).json()
    assert "2030-01-07T15:00:00Z" in cambiando["horas"]


def test_horas_libres_de_hoy_no_exige_antelacion(api: TestClient, sesion: Session) -> None:
    entrar(api, sesion)
    # Ahora es martes 1 de enero 10:00 Bogotá: las 10:30 sí se ofrecen (la web exigiría 60 min).
    horas = api.get("/yo/horas", params={"dia": "2030-01-01"}).json()["horas"]
    assert "2030-01-01T15:30:00Z" in horas
    assert "2030-01-01T15:00:00Z" in horas


def test_excluir_cita_de_otro_sobandero_no_cambia_nada(api: TestClient, sesion: Session) -> None:
    entrar(api, sesion, 1)
    otro = sobandero_con_login(sesion, 2)
    ajena = crear_cita(sesion, otro, crear_cliente(sesion), INICIO)
    horas = api.get("/yo/horas", params={"dia": LUNES, "excluir_cita": ajena.id}).json()
    assert "2030-01-07T15:00:00Z" in horas["horas"]  # libre de todos modos: es su propia agenda


def test_dias_con_horas_libres(api: TestClient, sesion: Session) -> None:
    entrar(api, sesion)
    dias = api.get("/yo/dias").json()["dias"]
    assert dias[0] == "2030-01-01"
    assert "2030-01-05" not in dias  # sábado sin horario
    assert "2030-01-07" in dias


def test_ver_horario_con_siete_dias(api: TestClient, sesion: Session) -> None:
    entrar(api, sesion)
    cuerpo = api.get("/yo/horario").json()
    assert cuerpo["duracion_min"] == 30
    assert [d["dia_semana"] for d in cuerpo["dias"]] == list(range(7))
    assert cuerpo["dias"][0]["franjas"] == [
        {"desde": "08:00", "hasta": "12:00"},
        {"desde": "14:00", "hasta": "18:00"},
    ]
    assert cuerpo["dias"][5]["franjas"] == []


def test_guardar_horario_reemplaza_y_no_toca_citas(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    cita = crear_cita(sesion, yo, crear_cliente(sesion), INICIO)
    dias = [{"dia_semana": 0, "franjas": [{"desde": "09:00", "hasta": "13:00"}]}]
    dias += [{"dia_semana": d, "franjas": []} for d in range(1, 7)]
    respuesta = api.put("/yo/horario", json={"dias": dias}, headers=CSRF)
    assert respuesta.status_code == 200
    assert respuesta.json()["dias"][0]["franjas"] == [{"desde": "09:00", "hasta": "13:00"}]
    assert respuesta.json()["dias"][1]["franjas"] == []
    franjas = sesion.scalars(select(Horario).where(Horario.sobandero_id == yo.id)).all()
    assert len(franjas) == 1
    sesion.refresh(cita)
    assert cita.estado == "agendada"


def test_horario_invalido_da_422(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)

    def guardar(franjas: list[dict[str, str]], dia: int = 0) -> int:
        cuerpo = {"dias": [{"dia_semana": dia, "franjas": franjas}]}
        return api.put("/yo/horario", json=cuerpo, headers=CSRF).status_code

    assert guardar([{"desde": "12:00", "hasta": "08:00"}]) == 422
    assert guardar([{"desde": "08:00", "hasta": "08:00"}]) == 422
    assert (
        guardar([{"desde": "08:00", "hasta": "12:00"}, {"desde": "11:00", "hasta": "15:00"}]) == 422
    )
    assert guardar([{"desde": "8am", "hasta": "12:00"}]) == 422
    assert guardar([{"desde": "08:00", "hasta": "09:00"}], dia=7) == 422
    muchas = [{"desde": f"{h:02d}:00", "hasta": f"{h:02d}:30"} for h in range(6, 11)]
    assert guardar(muchas) == 422
    dos_veces = {"dias": [{"dia_semana": 1, "franjas": []}, {"dia_semana": 1, "franjas": []}]}
    assert api.put("/yo/horario", json=dos_veces, headers=CSRF).status_code == 422
    assert len(sesion.scalars(select(Horario).where(Horario.sobandero_id == yo.id)).all()) == 10


def test_el_horario_es_solo_del_sobandero(api: TestClient, sesion: Session) -> None:
    entrar(api, sesion, 1)
    otro = sobandero_con_login(sesion, 2)
    dias = [{"dia_semana": d, "franjas": []} for d in range(7)]
    api.put("/yo/horario", json={"dias": dias}, headers=CSRF)
    assert len(sesion.scalars(select(Horario).where(Horario.sobandero_id == otro.id)).all()) == 10


def bloqueo(inicio: str, fin: str, motivo: str | None = None) -> dict[str, str | None]:
    return {"inicio": inicio, "fin": fin, "motivo": motivo}


def test_bloquear_quita_horas_y_no_cancela_citas(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    cita = crear_cita(sesion, yo, crear_cliente(sesion), INICIO)  # lunes 10:00-10:30
    # Lunes 10:00 a 12:00 en Bogotá.
    r = api.post(
        "/yo/bloqueos",
        json=bloqueo("2030-01-07T15:00:00Z", "2030-01-07T17:00:00Z", "Una diligencia"),
        headers=CSRF,
    )
    assert r.status_code == 201
    assert r.json()["citas_afectadas"] == 1
    assert r.json()["motivo"] == "Una diligencia"
    horas = api.get("/yo/horas", params={"dia": LUNES}).json()["horas"]
    assert not any("T15:" <= h[10:] < "T17:" for h in horas)
    sesion.refresh(cita)
    assert cita.estado == "agendada"


def test_bloqueo_invalido_da_422(api: TestClient, sesion: Session) -> None:
    entrar(api, sesion)
    p = "/yo/bloqueos"
    assert (
        api.post(
            p, json=bloqueo("2030-01-07T17:00:00Z", "2030-01-07T15:00:00Z"), headers=CSRF
        ).status_code
        == 422
    )
    assert (
        api.post(
            p, json=bloqueo("2030-01-07T15:00:00Z", "2030-01-07T15:00:00Z"), headers=CSRF
        ).status_code
        == 422
    )
    # Ya pasó (ahora es el 1 de enero, 15:00Z).
    assert (
        api.post(
            p, json=bloqueo("2030-01-01T13:00:00Z", "2030-01-01T14:00:00Z"), headers=CSRF
        ).status_code
        == 422
    )
    assert (
        api.post(
            p, json=bloqueo("2030-01-07T15:00:00", "2030-01-07T17:00:00"), headers=CSRF
        ).status_code
        == 422
    )


def test_listar_y_quitar_bloqueos_propios(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    creado = api.post(
        "/yo/bloqueos",
        json=bloqueo("2030-01-07T15:00:00Z", "2030-01-07T17:00:00Z"),
        headers=CSRF,
    ).json()
    # Uno que ya terminó no se lista (se crea directo: la API no deja crear bloqueos pasados).
    sesion.add(Bloqueo(sobandero_id=yo.id, rango=rango(INICIO - timedelta(days=30))))
    sesion.flush()
    lista = api.get("/yo/bloqueos").json()
    assert [b["id"] for b in lista] == [creado["id"]]
    assert api.delete(f"/yo/bloqueos/{creado['id']}", headers=CSRF).status_code == 204
    assert sesion.get(Bloqueo, creado["id"]) is None
    assert api.delete(f"/yo/bloqueos/{creado['id']}", headers=CSRF).status_code == 404


def test_no_ve_ni_quita_bloqueos_de_otro(api: TestClient, sesion: Session) -> None:
    entrar(api, sesion, 1)
    otro = sobandero_con_login(sesion, 2)
    ajeno = Bloqueo(sobandero_id=otro.id, rango=rango(INICIO + timedelta(days=1)))
    sesion.add(ajeno)
    sesion.flush()
    assert api.get("/yo/bloqueos").json() == []
    assert api.delete(f"/yo/bloqueos/{ajeno.id}", headers=CSRF).status_code == 404
    assert sesion.get(Bloqueo, ajeno.id) is not None

"""Clientes del sobandero: solo los que han tenido citas con él."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modelos import Cliente
from tests.conftest import (
    AHORA_PRUEBA,
    INICIO,
    crear_cita,
    crear_cliente,
    crear_usuario,
    ingresar,
    sobandero_con_login,
)


def entrar(api: TestClient, sesion: Session, numero: int = 1):  # type: ignore[no-untyped-def]
    sobandero = sobandero_con_login(sesion, numero)
    assert ingresar(api, sobandero.usuario.correo).status_code == 200
    return sobandero


def test_exige_sesion_y_perfil(api: TestClient, sesion: Session) -> None:
    assert api.get("/yo/clientes").status_code == 401
    assert api.get("/yo/clientes/1").status_code == 401
    crear_usuario(sesion, "admin@sobanderia.test", rol="admin")
    ingresar(api, "admin@sobanderia.test")
    assert api.get("/yo/clientes").status_code == 403


def test_lista_solo_clientes_propios_con_ultima_cita(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion, 1)
    otro = sobandero_con_login(sesion, 2)
    mia = crear_cliente(sesion, 1)
    ajena = crear_cliente(sesion, 2)
    solo_cancelada = crear_cliente(sesion, 3)  # ajena = otro sobandero
    crear_cita(sesion, yo, mia, AHORA_PRUEBA - timedelta(days=10))
    crear_cita(sesion, yo, mia, AHORA_PRUEBA - timedelta(days=3))
    crear_cita(sesion, yo, mia, INICIO)  # futura: no cuenta como «última cita»
    crear_cita(sesion, otro, ajena, INICIO)
    crear_cita(sesion, yo, solo_cancelada, INICIO + timedelta(days=1), estado="cancelada")

    lista = api.get("/yo/clientes").json()
    # Quien solo canceló también es cliente suyo; va al final porque no tiene cita anterior.
    assert [c["id"] for c in lista] == [mia.id, solo_cancelada.id]
    assert (lista[1]["total"], lista[1]["ultima_cita"]) == (0, None)
    assert lista[0]["total"] == 3
    assert lista[0]["ultima_cita"] == "2029-12-29T15:00:00Z"
    assert lista[0]["celular"] == mia.celular


def test_busca_por_nombre_o_celular(api: TestClient, sesion: Session) -> None:
    yo = entrar(api, sesion)
    luz = Cliente(nombre="Luz Dary Pineda", celular="+573001234567")
    hernan = Cliente(nombre="Hernán Castaño", celular="+573109876543")
    sesion.add_all([luz, hernan])
    sesion.flush()
    crear_cita(sesion, yo, luz, INICIO)
    crear_cita(sesion, yo, hernan, INICIO + timedelta(hours=1))

    def buscar(q: str) -> list[int]:
        return [c["id"] for c in api.get("/yo/clientes", params={"q": q}).json()]

    assert buscar("luz dary") == [luz.id]
    assert buscar("hernán") == [hernan.id]
    assert buscar("300 123") == [luz.id]
    assert buscar("3109876543") == [hernan.id]
    assert buscar("zzz") == []
    assert buscar("%") == []  # los comodines de SQL no se interpretan
    assert sorted(buscar("")) == sorted([luz.id, hernan.id])


def test_ficha_con_proximas_e_historial_solo_de_este_sobandero(
    api: TestClient, sesion: Session
) -> None:
    yo = entrar(api, sesion, 1)
    otro = sobandero_con_login(sesion, 2)
    cliente = crear_cliente(sesion)
    crear_cita(sesion, yo, cliente, AHORA_PRUEBA - timedelta(days=7), estado="atendida")
    crear_cita(sesion, yo, cliente, AHORA_PRUEBA - timedelta(days=14), estado="no_asistio")
    crear_cita(sesion, yo, cliente, INICIO)
    crear_cita(sesion, otro, cliente, INICIO + timedelta(days=1))  # no es mía

    ficha = api.get(f"/yo/clientes/{cliente.id}").json()
    assert ficha["nombre"] == cliente.nombre
    assert ficha["total"] == 3
    assert [c["inicio"] for c in ficha["proximas"]] == ["2030-01-07T15:00:00Z"]
    assert [c["estado"] for c in ficha["historial"]] == ["atendida", "no_asistio"]
    assert ficha["cliente_desde"]


def test_ficha_de_un_cliente_ajeno_da_404(api: TestClient, sesion: Session) -> None:
    entrar(api, sesion, 1)
    otro = sobandero_con_login(sesion, 2)
    ajeno = crear_cliente(sesion)
    crear_cita(sesion, otro, ajeno, INICIO)
    assert api.get(f"/yo/clientes/{ajeno.id}").status_code == 404
    assert api.get("/yo/clientes/999999").status_code == 404

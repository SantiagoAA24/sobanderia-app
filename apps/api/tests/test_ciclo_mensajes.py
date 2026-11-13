"""Disparadores de WhatsApp y ciclo de vida completo con el proveedor falso."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modelos import Cita, Notificacion
from app.servicios import bandeja
from app.whatsapp import Falso
from tests.conftest import AHORA_PRUEBA, CSRF, sobandero_con_horario
from tests.test_mi_cita import NUEVA, agendar
from tests.test_publico_citas import datos


def _por_cita(sesion: Session, cita_id: int) -> dict[str, list[Notificacion]]:
    agrupadas: dict[str, list[Notificacion]] = {}
    for fila in sesion.scalars(select(Notificacion).where(Notificacion.cita_id == cita_id)):
        agrupadas.setdefault(fila.tipo, []).append(fila)
    return agrupadas


def test_cita_nueva_crea_una_confirmacion_y_un_recordatorio(
    api: TestClient, sesion: Session
) -> None:
    agendar(api, sesion)
    cita = sesion.scalars(select(Cita)).one()
    agrupadas = _por_cita(sesion, cita.id)
    assert {tipo: len(filas) for tipo, filas in agrupadas.items()} == {
        "confirmacion": 1,
        "recordatorio": 1,
    }
    assert sesion.scalar(select(func.count()).select_from(Notificacion)) == 2


def test_cancelar_cancela_el_recordatorio_y_borra_los_tokens_pendientes(
    api: TestClient, sesion: Session
) -> None:
    token, _ = agendar(api, sesion)
    api.post(f"/mi-cita/{token}/cancelar", headers=CSRF)
    cita = sesion.scalars(select(Cita)).one()
    agrupadas = _por_cita(sesion, cita.id)
    assert agrupadas["recordatorio"][0].estado == "cancelada"
    assert agrupadas["confirmacion"][0].estado == "cancelada"
    assert "token" not in agrupadas["confirmacion"][0].variables  # nunca se envió: no se guarda
    assert agrupadas["cancelacion"][0].estado == "pendiente"


def test_reprogramar_deja_un_solo_recordatorio_pendiente(api: TestClient, sesion: Session) -> None:
    token, _ = agendar(api, sesion)
    api.post(f"/mi-cita/{token}/reprogramar", json={"inicio": NUEVA.isoformat()}, headers=CSRF)
    pendientes = sesion.scalars(
        select(Notificacion).where(
            Notificacion.tipo == "recordatorio", Notificacion.estado == "pendiente"
        )
    ).all()
    assert len(pendientes) == 1
    nueva = sesion.scalars(select(Cita).where(Cita.estado == "agendada")).one()
    assert pendientes[0].cita_id == nueva.id


def test_encontrar_mi_cita_usa_la_plantilla_enlace_cita(api: TestClient, sesion: Session) -> None:
    agendar(api, sesion)
    antes = sesion.scalar(select(func.count()).select_from(Notificacion))
    api.post("/publico/mi-cita/enlace", json={"celular": "300 123 4567"}, headers=CSRF)
    nuevas = sesion.scalars(select(Notificacion).order_by(Notificacion.id)).all()[antes:]
    assert [n.plantilla for n in nuevas] == ["enlace_cita"]


def test_ciclo_de_vida_deja_los_mensajes_correctos(api: TestClient, sesion: Session) -> None:
    """Agendar, reprogramar y cancelar: lo que sale por WhatsApp, en orden y sin repetirse."""
    proveedor = Falso()
    sobandero = sobandero_con_horario(sesion)
    token = api.post("/publico/citas", json=datos(sobandero.id), headers=CSRF).json()["token"]

    # Ahora mismo solo sale la confirmación; el recordatorio espera al día anterior.
    assert bandeja.vaciar(sesion, proveedor, AHORA_PRUEBA) == 1
    assert [m.plantilla for m in proveedor.enviados] == ["cita_confirmada"]
    assert proveedor.enviados[0].codigo_enlace == token

    api.post(f"/mi-cita/{token}/reprogramar", json={"inicio": NUEVA.isoformat()}, headers=CSRF)
    assert bandeja.vaciar(sesion, proveedor, AHORA_PRUEBA) == 1
    assert proveedor.enviados[-1].plantilla == "cita_cambiada"
    assert proveedor.enviados[-1].parametros[2:] == ("martes 8 de enero", "10:00 a. m.")

    # El día anterior a las 6:00 p. m. (Bogotá) sale el recordatorio de la cita nueva, una vez.
    vispera = NUEVA - timedelta(hours=16)  # lunes 7 de enero, 18:00 en Bogotá
    assert bandeja.vaciar(sesion, proveedor, vispera) == 1
    assert proveedor.enviados[-1].plantilla == "recordatorio_cita"
    assert bandeja.vaciar(sesion, proveedor, vispera) == 0

    api.post(f"/mi-cita/{token}/cancelar", headers=CSRF)
    assert bandeja.vaciar(sesion, proveedor, vispera) == 1
    assert [m.plantilla for m in proveedor.enviados] == [
        "cita_confirmada",
        "cita_cambiada",
        "recordatorio_cita",
        "cita_cancelada",
    ]
    # Nada quedó sin resolver ni con el token a la vista.
    estados = {n.estado for n in sesion.scalars(select(Notificacion))}
    assert estados <= {"enviada", "cancelada"}
    assert all("token" not in n.variables for n in sesion.scalars(select(Notificacion)))

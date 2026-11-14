"""Exportar y anonimizar los datos de un cliente (Fase 10.3)."""

import json
import os
import stat
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import cli_datos
from app.errores import ErrorApi
from app.modelos import Auditoria, Cita, Cliente, EnlaceCita, IntentoIngreso, Notificacion
from app.seguridad.celular import normalizar_celular
from app.servicios import datos_cliente as servicio
from tests.conftest import AHORA_PRUEBA, CSRF, sobandero_con_horario

CELULAR = "3205550101"
E164 = "+573205550101"
OTRO = "3119998877"


def reservar(api: TestClient, sobandero_id: int, hora: str, celular: str, nombre: str) -> str:
    r = api.post(
        "/publico/citas",
        json={
            "sobandero_id": sobandero_id,
            "inicio": hora,
            "nombre": nombre,
            "celular": celular,
            "consentimiento": True,
        },
        headers=CSRF,
    )
    assert r.status_code == 201, r.text
    return str(r.json()["token"])


@pytest.fixture
def escenario(api: TestClient, sesion: Session) -> dict[str, object]:
    """Rosa (con una cita por venir) y Pedro (otro cliente que no debe tocarse)."""
    sobandero = sobandero_con_horario(sesion, 1)
    horas = api.get(f"/publico/sobanderos/{sobandero.id}/horas", params={"dia": "2030-01-08"})
    libres = horas.json()["horas"]
    token = reservar(api, sobandero.id, libres[0], CELULAR, "Rosa Prueba")
    reservar(api, sobandero.id, libres[1], OTRO, "Pedro Otro")
    api.post("/publico/mi-cita/enlace", json={"celular": CELULAR}, headers=CSRF)
    return {"token": token}


def rosa(sesion: Session) -> Cliente:
    return servicio.buscar_cliente(sesion, CELULAR)


# --- Exportar ---------------------------------------------------------------------------------


def test_exportar_trae_todo_lo_que_se_guarda_y_ningun_token(
    sesion: Session, escenario: dict[str, object]
) -> None:
    datos = servicio.exportar(sesion, rosa(sesion), AHORA_PRUEBA)
    assert datos["cliente"]["nombre"] == "Rosa Prueba"  # type: ignore[index]
    assert datos["cliente"]["celular"] == E164  # type: ignore[index]
    assert datos["cliente"]["politica_version"]  # type: ignore[index]
    assert len(datos["citas"]) == 1  # type: ignore[arg-type]
    assert datos["citas"][0]["estado"] == "agendada"  # type: ignore[index]
    assert datos["mensajes"]  # la confirmación y el recordatorio
    texto = json.dumps(datos)
    assert escenario["token"] not in texto
    assert "Pedro" not in texto and OTRO not in texto and "3119998877" not in texto


def test_exportar_deja_registro_sin_el_celular(
    sesion: Session, escenario: dict[str, object]
) -> None:
    servicio.exportar(sesion, rosa(sesion), AHORA_PRUEBA)
    fila = sesion.scalars(select(Auditoria).where(Auditoria.accion == "cliente_exportado")).one()
    assert E164 not in json.dumps(fila.detalle) and CELULAR not in json.dumps(fila.detalle)


def test_buscar_normaliza_el_celular_igual_que_al_agendar(
    sesion: Session, escenario: dict[str, object]
) -> None:
    for escrito in ("320 555 0101", "+57 320 555 0101", "573205550101", CELULAR):
        assert servicio.buscar_cliente(sesion, escrito).nombre == "Rosa Prueba"


def test_un_celular_que_no_existe_o_no_es_valido_se_rechaza(
    sesion: Session, escenario: dict[str, object]
) -> None:
    with pytest.raises(ErrorApi) as no_existe:
        servicio.buscar_cliente(sesion, "3001112233")
    assert no_existe.value.estado == 404
    with pytest.raises(ErrorApi) as invalido:
        servicio.buscar_cliente(sesion, "123")
    assert invalido.value.estado == 422


# --- Anonimizar -------------------------------------------------------------------------------


def test_con_una_cita_por_venir_se_detiene_y_no_cambia_nada(
    sesion: Session, escenario: dict[str, object]
) -> None:
    cliente = rosa(sesion)
    with pytest.raises(ErrorApi) as error:
        servicio.anonimizar(sesion, cliente, AHORA_PRUEBA)
    assert error.value.estado == 409 and error.value.codigo == "citas_futuras"
    assert sesion.get(Cliente, cliente.id).nombre == "Rosa Prueba"  # type: ignore[union-attr]
    assert sesion.scalars(select(Cita).where(Cita.cliente_id == cliente.id)).one().estado == (
        "agendada"
    )


def test_anonimizar_quita_a_la_persona_y_conserva_el_historial(
    sesion: Session, escenario: dict[str, object]
) -> None:
    cliente = rosa(sesion)
    cliente_id = cliente.id
    total_citas = sesion.scalar(select(func.count()).select_from(Cita))
    resultado = servicio.anonimizar(sesion, cliente, AHORA_PRUEBA, cancelar_futuras=True)

    assert resultado.citas_futuras_canceladas == 1
    assert resultado.enlaces_revocados == 1 and resultado.intentos_borrados >= 1
    sesion.expire_all()
    cliente = sesion.get(Cliente, cliente_id)  # type: ignore[assignment]
    assert cliente.nombre == servicio.NOMBRE_ANONIMO
    assert cliente.celular == servicio.celular_anonimo(cliente_id)
    assert normalizar_celular(cliente.celular) == cliente.celular  # sigue siendo E.164 válido
    # El historial se conserva: mismas citas, la futura quedó cancelada por la administración.
    assert sesion.scalar(select(func.count()).select_from(Cita)) == total_citas
    cita = sesion.scalars(select(Cita).where(Cita.cliente_id == cliente_id)).one()
    assert (cita.estado, cita.cancelada_por) == ("cancelada", "admin")


def test_anonimizar_borra_el_nombre_los_tokens_y_los_rastros_del_celular(
    sesion: Session, escenario: dict[str, object]
) -> None:
    cliente = rosa(sesion)
    cliente_id = cliente.id
    antes = sesion.scalars(
        select(Notificacion)
        .join(Cita, Cita.id == Notificacion.cita_id)
        .where(Cita.cliente_id == cliente_id)
    ).all()
    assert any("nombre" in n.variables for n in antes)  # el nombre estaba en los mensajes

    servicio.anonimizar(sesion, cliente, AHORA_PRUEBA, cancelar_futuras=True)
    sesion.expire_all()
    despues = sesion.scalars(
        select(Notificacion)
        .join(Cita, Cita.id == Notificacion.cita_id)
        .where(Cita.cliente_id == cliente_id)
    ).all()
    assert despues
    for n in despues:
        assert "nombre" not in n.variables and "token" not in n.variables
        assert "Rosa" not in json.dumps(n.variables)
        assert n.estado != "pendiente"  # nada sale hacia el número anonimizado
    assert (
        sesion.scalar(
            select(func.count())
            .select_from(EnlaceCita)
            .join(Cita)
            .where(Cita.cliente_id == cliente_id)
        )
        == 0
    )
    assert servicio.NOMBRE_ANONIMO not in json.dumps([n.variables for n in despues])


def test_cancelar_al_anonimizar_no_envia_aviso_al_numero_que_se_borra(
    sesion: Session, escenario: dict[str, object]
) -> None:
    cliente = rosa(sesion)
    servicio.anonimizar(sesion, cliente, AHORA_PRUEBA, cancelar_futuras=True)
    avisos = sesion.scalar(
        select(func.count()).select_from(Notificacion).where(Notificacion.tipo == "cancelacion")
    )
    assert avisos == 0


def test_anonimizar_no_toca_a_otros_clientes(sesion: Session, escenario: dict[str, object]) -> None:
    servicio.anonimizar(sesion, rosa(sesion), AHORA_PRUEBA, cancelar_futuras=True)
    pedro = servicio.buscar_cliente(sesion, OTRO)
    assert pedro.nombre == "Pedro Otro"
    cita = sesion.scalars(select(Cita).where(Cita.cliente_id == pedro.id)).one()
    assert cita.estado == "agendada"
    assert (
        sesion.scalar(
            select(func.count()).select_from(EnlaceCita).where(EnlaceCita.cita_id == cita.id)
        )
        == 1
    )


def test_despues_de_anonimizar_el_celular_ya_no_se_encuentra_y_puede_volver_a_agendar(
    api: TestClient, sesion: Session, escenario: dict[str, object]
) -> None:
    servicio.anonimizar(sesion, rosa(sesion), AHORA_PRUEBA, cancelar_futuras=True)
    with pytest.raises(ErrorApi):
        servicio.buscar_cliente(sesion, CELULAR)
    sobandero_id = sesion.scalars(select(Cita.sobandero_id)).first()
    libres = api.get(f"/publico/sobanderos/{sobandero_id}/horas", params={"dia": "2030-01-09"})
    reservar(api, sobandero_id, libres.json()["horas"][0], CELULAR, "Rosa Nueva")  # type: ignore[arg-type]
    assert servicio.buscar_cliente(sesion, CELULAR).nombre == "Rosa Nueva"


def test_anonimizar_deja_registro_sin_nombre_ni_celular(
    sesion: Session, escenario: dict[str, object]
) -> None:
    servicio.anonimizar(sesion, rosa(sesion), AHORA_PRUEBA, cancelar_futuras=True)
    fila = sesion.scalars(select(Auditoria).where(Auditoria.accion == "cliente_anonimizado")).one()
    detalle = json.dumps(fila.detalle)
    assert CELULAR not in detalle and "Rosa" not in detalle


def test_los_intentos_de_encontrar_mi_cita_de_otros_no_se_borran(
    api: TestClient, sesion: Session, escenario: dict[str, object]
) -> None:
    api.post("/publico/mi-cita/enlace", json={"celular": OTRO}, headers=CSRF)
    antes = sesion.scalar(select(func.count()).select_from(IntentoIngreso))
    servicio.anonimizar(sesion, rosa(sesion), AHORA_PRUEBA, cancelar_futuras=True)
    despues = sesion.scalar(select(func.count()).select_from(IntentoIngreso))
    assert despues is not None and antes is not None and 0 < despues < antes


# --- La línea de comandos ---------------------------------------------------------------------


@pytest.fixture
def cli(sesion: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    @contextmanager
    def prestada() -> Iterator[Session]:
        yield sesion

    monkeypatch.setattr(cli_datos, "sesion_nueva", prestada)


def test_cli_exportar_escribe_un_archivo_privado_y_no_imprime_el_celular(
    cli: None,
    escenario: dict[str, object],
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    destino = tmp_path / "rosa.json"
    assert cli_datos.main(["exportar", "--celular", CELULAR, "--salida", str(destino)]) == 0
    salida = capsys.readouterr().out
    assert "320 *** 0101" in salida and CELULAR not in salida and E164 not in salida
    assert json.loads(destino.read_text(encoding="utf-8"))["cliente"]["celular"] == E164
    assert stat.S_IMODE(os.stat(destino).st_mode) == 0o600


def test_cli_exportar_no_sobrescribe_un_archivo_existente(
    cli: None, escenario: dict[str, object], tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    destino = tmp_path / "rosa.json"
    destino.write_text("no tocar")
    assert cli_datos.main(["exportar", "--celular", CELULAR, "--salida", str(destino)]) == 1
    assert destino.read_text() == "no tocar"
    assert "ya existe" in capsys.readouterr().err


def test_cli_anonimizar_sin_confirmar_solo_muestra_lo_que_haria(
    cli: None,
    sesion: Session,
    escenario: dict[str, object],
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert cli_datos.main(["anonimizar", "--celular", CELULAR]) == 0
    salida = capsys.readouterr().out
    assert "--confirmar" in salida and "Citas futuras agendadas: 1" in salida
    assert CELULAR not in salida
    assert rosa(sesion).nombre == "Rosa Prueba"


def test_cli_anonimizar_con_cita_futura_exige_cancelarla_a_proposito(
    cli: None,
    sesion: Session,
    escenario: dict[str, object],
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert cli_datos.main(["anonimizar", "--celular", CELULAR, "--confirmar"]) == 1
    assert "cita(s) agendada(s)" in capsys.readouterr().err
    assert rosa(sesion).nombre == "Rosa Prueba"
    args = ["anonimizar", "--celular", CELULAR, "--confirmar", "--cancelar-citas-futuras"]
    assert cli_datos.main(args) == 0
    assert "anonimizado" in capsys.readouterr().out
    with pytest.raises(ErrorApi):
        servicio.buscar_cliente(sesion, CELULAR)


def test_cli_con_un_celular_que_no_existe_falla_sin_romper(
    cli: None, escenario: dict[str, object], capsys: pytest.CaptureFixture[str]
) -> None:
    assert cli_datos.main(["anonimizar", "--celular", "3001112233", "--confirmar"]) == 1
    assert "No hay un cliente" in capsys.readouterr().err

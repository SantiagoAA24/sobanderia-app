import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modelos import Horario, Negocio, Sobandero, Usuario
from app.seed import EntornoNoPermitido, sembrar


def conteos(sesion: Session) -> tuple[int, int, int, int, int]:
    def contar(modelo: type) -> int:
        return sesion.scalar(select(func.count()).select_from(modelo)) or 0

    admins = (
        sesion.scalar(select(func.count()).select_from(Usuario).where(Usuario.rol == "admin")) or 0
    )
    return admins, contar(Usuario), contar(Sobandero), contar(Horario), contar(Negocio)


def test_seed_crea_admin_cuatro_sobanderos_con_horario(sesion: Session) -> None:
    sembrar(sesion, "desarrollo", clave="clave-de-prueba")
    admins, usuarios, sobanderos, horarios, negocios = conteos(sesion)
    assert (admins, usuarios, sobanderos, negocios) == (1, 5, 4, 1)
    assert horarios > 0
    for sobandero in sesion.scalars(select(Sobandero)):
        assert sobandero.usuario.clave_hash.startswith("$argon2id$")
        assert sobandero.usuario.debe_cambiar_clave


def test_seed_es_repetible(sesion: Session) -> None:
    sembrar(sesion, "desarrollo", clave="clave-de-prueba")
    primero = conteos(sesion)
    sembrar(sesion, "desarrollo", clave="otra-clave")
    assert conteos(sesion) == primero


@pytest.mark.parametrize("entorno", ["produccion", "production", "prod", "staging"])
def test_seed_se_niega_fuera_de_desarrollo(sesion: Session, entorno: str) -> None:
    with pytest.raises(EntornoNoPermitido):
        sembrar(sesion, entorno)
    assert conteos(sesion) == (0, 0, 0, 0, 0)

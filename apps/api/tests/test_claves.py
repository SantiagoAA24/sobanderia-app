from app.seguridad.claves import hashear_clave, verificar_clave
from app.seguridad.tokens import generar_token, hash_token


def test_hash_argon2id_se_verifica_y_rechaza_otras_claves() -> None:
    hash_ = hashear_clave("clave-segura-1")
    assert hash_.startswith("$argon2id$")
    assert verificar_clave(hash_, "clave-segura-1")
    assert not verificar_clave(hash_, "clave-segura-2")
    assert not verificar_clave("no-es-un-hash", "clave-segura-1")


def test_tokens_son_aleatorios_y_su_hash_no_los_revela() -> None:
    a, b = generar_token(), generar_token()
    assert a != b
    assert len(a) >= 43  # 32 bytes en base64 url
    assert hash_token(a) != a
    assert hash_token(a) == hash_token(a)
    assert len(hash_token(a)) == 64

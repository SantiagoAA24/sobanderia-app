"""El contrato OpenAPI describe las rutas de la Fase 3 y sus errores."""

from fastapi.testclient import TestClient

RUTAS = {
    ("get", "/publico/sobanderos"),
    ("get", "/publico/sobanderos/{sobandero_id}/dias"),
    ("get", "/publico/sobanderos/{sobandero_id}/horas"),
    ("post", "/publico/citas"),
    ("get", "/mi-cita/{token}"),
    ("post", "/mi-cita/{token}/reprogramar"),
    ("post", "/mi-cita/{token}/cancelar"),
    ("get", "/yo/citas"),
    ("post", "/yo/citas"),
    ("patch", "/yo/citas/{cita_id}"),
}


def test_las_rutas_estan_en_openapi(api: TestClient) -> None:
    caminos = api.get("/openapi.json").json()["paths"]
    for metodo, ruta in RUTAS:
        assert metodo in caminos.get(ruta, {}), (metodo, ruta)


def test_crear_cita_documenta_hora_ocupada_con_alternativas(api: TestClient) -> None:
    esquema = api.get("/openapi.json").json()
    respuestas = esquema["paths"]["/publico/citas"]["post"]["responses"]
    assert {"201", "404", "409", "422"} <= set(respuestas)
    ref = respuestas["409"]["content"]["application/json"]["schema"]["$ref"]
    modelo = esquema["components"]["schemas"][ref.rsplit("/", 1)[1]]
    assert "alternativas" in modelo["properties"]


def test_enlace_vencido_esta_documentado(api: TestClient) -> None:
    caminos = api.get("/openapi.json").json()["paths"]
    for ruta in ("/mi-cita/{token}", "/mi-cita/{token}/cancelar", "/mi-cita/{token}/reprogramar"):
        metodo = "get" if ruta == "/mi-cita/{token}" else "post"
        assert "410" in caminos[ruta][metodo]["responses"], ruta

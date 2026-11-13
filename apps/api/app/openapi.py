"""Escribe el contrato OpenAPI sin levantar el servidor: `python -m app.openapi > openapi.json`."""

import json
import sys

from app.main import app

if __name__ == "__main__":
    json.dump(app.openapi(), sys.stdout, ensure_ascii=False, indent=2, sort_keys=True)
    sys.stdout.write("\n")

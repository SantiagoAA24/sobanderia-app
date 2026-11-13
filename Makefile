.PHONY: help setup dev down test check seed migrate cliente cliente-al-dia

help:
	@echo "make setup   - instala dependencias de api y web"
	@echo "make dev     - levanta base, api, worker y web en local"
	@echo "make down    - apaga el entorno local"
	@echo "make test    - corre las pruebas de api y web"
	@echo "make check   - lint, tipos y pruebas (debe pasar antes de cada commit)"
	@echo "make migrate - aplica las migraciones de la base"
	@echo "make seed    - carga datos de ejemplo (solo desarrollo)"
	@echo "make cliente - regenera el cliente TypeScript desde el OpenAPI de la API"

setup:
	cd apps/api && python -m pip install -e ".[dev]"
	cd apps/web && npm install

dev:
	docker compose up --build

down:
	docker compose down

migrate:
	cd apps/api && alembic upgrade head

seed:
	cd apps/api && python -m app.seed

test:
	cd apps/api && pytest
	cd apps/web && npm test -- --run

cliente:
	cd apps/api && python -m app.openapi > ../web/src/api/openapi.json
	cd apps/web && npx openapi-typescript src/api/openapi.json -o src/api/esquema.d.ts

cliente-al-dia:
	@cd apps/api && python -m app.openapi | diff -q - ../web/src/api/openapi.json >/dev/null || { echo "openapi.json desactualizado: ejecute make cliente"; exit 1; }
	@cd apps/web && npx openapi-typescript src/api/openapi.json | diff -q - src/api/esquema.d.ts >/dev/null || { echo "esquema.d.ts desactualizado: ejecute make cliente"; exit 1; }
	@echo "Cliente de la API al día"

check:
	cd apps/api && ruff check . && ruff format --check . && mypy app && pytest
	$(MAKE) cliente-al-dia
	cd apps/web && npm run check && npm test -- --run

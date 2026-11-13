.PHONY: help setup dev down test check seed migrate

help:
	@echo "make setup   - instala dependencias de api y web"
	@echo "make dev     - levanta base, api, worker y web en local"
	@echo "make down    - apaga el entorno local"
	@echo "make test    - corre las pruebas de api y web"
	@echo "make check   - lint, tipos y pruebas (debe pasar antes de cada commit)"
	@echo "make migrate - aplica las migraciones de la base"
	@echo "make seed    - carga datos de ejemplo (solo desarrollo)"

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

check:
	cd apps/api && ruff check . && ruff format --check . && mypy app && pytest
	cd apps/web && npm run check && npm test -- --run

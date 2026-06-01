.PHONY: install setup dev dev-api dev-ui build deploy run-init validate test fmt clean help

help:
	@echo "Targets:"
	@echo "  install   Install Python + UI deps (uv + npm)"
	@echo "  setup     One-shot deploy from scratch (warehouse + grants + init + Genie + app)"
	@echo "  dev       Start API (8000) and UI dev server (5173) in parallel"
	@echo "  dev-api   Start FastAPI with reload"
	@echo "  dev-ui    Start Vite dev server"
	@echo "  build     Build the UI into src/lakehouse_market/static/"
	@echo "  validate  databricks bundle validate"
	@echo "  deploy    Build UI + databricks bundle deploy (assumes setup ran once)"
	@echo "  run-init  databricks bundle run lhm_init_job (data-gen + ML)"
	@echo "  test      Run pytest"
	@echo "  fmt       ruff format + check"
	@echo "  clean     Remove build artifacts"

install:
	uv sync --all-extras
	cd ui && npm install

setup: install
	bash scripts/setup.sh

dev:
	@trap 'kill 0' INT; \
	(cd ui && npm run dev) & \
	uv run uvicorn lakehouse_market.app:app --reload --port 8000

dev-api:
	uv run uvicorn lakehouse_market.app:app --reload --port 8000

dev-ui:
	cd ui && npm run dev

build:
	cd ui && npm install && npm run build

validate:
	databricks bundle validate

deploy: build
	databricks bundle deploy

run-init:
	databricks bundle run lhm_init_job

test:
	uv run pytest -v

fmt:
	uv run ruff format .
	uv run ruff check .

clean:
	rm -rf ui/dist src/lakehouse_market/static .pytest_cache .ruff_cache build dist
	find . -name __pycache__ -type d -exec rm -rf {} +

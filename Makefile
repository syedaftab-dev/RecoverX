.PHONY: help dev build down logs clean test test-unit healthcheck

help:
	@echo "RecoverX CLI commands:"
	@echo "  make dev         - Start all services with hot reload"
	@echo "  make build       - Build all Docker images"
	@echo "  make down        - Stop all running containers"
	@echo "  make logs        - Tail logs from all containers"
	@echo "  make clean       - Remove volumes and orphan containers"
	@echo "  make healthcheck - Run full health & data verification suite"
	@echo "  make test        - Run both unit & integration test suites"
	@echo "  make test-unit   - Run Day 3 Agent Tools unit test suite"

dev:
	docker compose up --build

build:
	docker compose build

down:
	docker compose down

logs:
	docker compose logs -f

clean:
	docker compose down -v --remove-orphans

healthcheck:
	node scripts/healthcheck.js

test-unit:
	node tests/unit/tools.test.js

test:
	node tests/unit/tools.test.js
	node tests/integration/catalog.test.js

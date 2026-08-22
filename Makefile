.PHONY: help dev build down logs clean test test-unit test-agent test-recovery healthcheck

help:
	@echo "RecoverX CLI commands:"
	@echo "  make dev           - Start all services with hot reload"
	@echo "  make build         - Build all Docker images"
	@echo "  make down          - Stop all running containers"
	@echo "  make logs          - Tail logs from all containers"
	@echo "  make clean         - Remove volumes and orphan containers"
	@echo "  make healthcheck   - Run full health & data verification suite"
	@echo "  make test          - Run complete test suite (Unit + Catalog + Agent + Recovery)"
	@echo "  make test-unit     - Run Day 3 Agent Tools unit test suite"
	@echo "  make test-agent    - Run Day 4 Agent Orchestrator integration tests"
	@echo "  make test-recovery - Run Day 5 Payment Decline Recovery integration tests"

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

test-agent:
	node tests/integration/agent.test.js

test-recovery:
	node tests/integration/recovery.test.js

test:
	node tests/unit/tools.test.js
	node tests/integration/catalog.test.js
	node tests/integration/agent.test.js
	node tests/integration/recovery.test.js

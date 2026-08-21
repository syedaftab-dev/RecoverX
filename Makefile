.PHONY: help dev build down logs clean test healthcheck

help:
	@echo "RecoverX CLI commands:"
	@echo "  make dev         - Start all services with hot reload"
	@echo "  make build       - Build all Docker images"
	@echo "  make down        - Stop all running containers"
	@echo "  make logs        - Tail logs from all containers"
	@echo "  make clean       - Remove volumes and orphan containers"
	@echo "  make healthcheck - Check health of all running services"

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
	@curl -s http://localhost:8080/api/payment/health || echo "Payment service unavailable"
	@curl -s http://localhost:8080/api/recovery/health || echo "Recovery service unavailable"
	@curl -s http://localhost:8080/api/audit/health || echo "Audit service unavailable"
	@curl -s http://localhost:8080/api/notification/health || echo "Notification service unavailable"

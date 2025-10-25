.PHONY: help up down logs build clean health restart shell

# Default target
help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

up: ## Start all services in detached mode
	docker compose up -d --build

down: ## Stop all services
	docker compose down

logs: ## Show logs from all services
	docker compose logs -f

build: ## Build all services without starting
	docker compose build

clean: ## Remove all containers, volumes, and images
	docker compose down -v --rmi all

health: ## Check health of all services
	@echo "Checking app health..."
	@curl -f http://localhost:5500/healthz || echo "App health check failed"
	@echo ""
	@echo "Checking Cloudflare tunnel..."
	@docker compose ps cloudflared | grep -q "Up" && echo "Cloudflared is running" || echo "Cloudflared is not running"

restart: ## Restart all services
	docker compose restart

shell: ## Open shell in app container
	docker compose exec app sh

status: ## Show status of all services
	docker compose ps

config: ## Show docker compose configuration
	docker compose config
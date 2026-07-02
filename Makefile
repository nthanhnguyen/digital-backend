.PHONY: help install setup migrate start test lint format clean all

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

setup: install ## Full setup: install deps, start docker, run migrations
	docker-compose up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 5
	npm run migrate
	@echo ""
	@echo "✅ Setup complete!"
	@echo "Start the app with: make start"

migrate: ## Run database migrations
	npm run migrate

start: ## Start the application in development mode
	npm run start:dev

start-prod: ## Start the application in production mode
	npm run build
	npm run start:prod

test: ## Run unit tests
	npm test

test-e2e: ## Run end-to-end tests
	npm run test:e2e

test-cov: ## Run tests with coverage
	npm run test:cov

lint: ## Lint code
	npm run lint

format: ## Format code
	npm run format

build: ## Build for production
	npm run build

docker-up: ## Start Docker services
	docker-compose up -d

docker-down: ## Stop Docker services
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

clean: ## Clean build artifacts and dependencies
	rm -rf dist node_modules coverage openapi

all: format lint build test test-e2e ## Run all checks (format, lint, build, tests)

.DEFAULT_GOAL := help

# Digital Wallet Backend

A modular NestJS-based API service platform with common utilities and patterns.

## 🚀 Quick Start

Get up and running in 3 steps:

```bash
# 1. Install dependencies
npm install

# 2. Setup everything (Docker, database, migrations)
make setup

# 3. Start the application
make start
```

That's it! The API will be available at:
- **API**: http://localhost:9000
- **Swagger Docs**: http://localhost:9000/docs

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** v24.13.0 (check `.nvmrc` or use `nvm use`)
- **npm** (comes with Node.js)
- **Docker** and **Docker Compose** (for PostgreSQL)

### Check Your Setup

```bash
node --version  # Should be v24.13.0
docker --version
docker-compose --version
```

---

## 🏗️ Step-by-Step Setup

### Step 1: Clone and Install

```bash
git clone <repository-url>
cd digital-wallet-backend
npm install
```

### Step 2: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

The default `.env` should work for local development. Key settings:

```env
NODE_ENV=local
NODE_PORT=9000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=digital_wallet_service
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### Step 3: Start Database

Start PostgreSQL using Docker:

```bash
docker-compose up -d
```

Wait a few seconds for PostgreSQL to be ready.

### Step 4: Run Migrations

Set up the database schema:

```bash
npm run migrate
```

This sets up the database schema based on the migrations in `db/migrations/`.

### Step 5: Start the Application

```bash
npm run start:dev
```

Or use the Makefile:

```bash
make start
```

### Step 6: Verify It's Working

1. **Check the API is running**: Open http://localhost:9000/docs
2. **Explore available endpoints**: Use the Swagger UI to see all available API endpoints
3. **Test an endpoint**: Try any public endpoint to verify the service is working

---

## ✅ Verify Your Setup

### Test the API

1. **Open Swagger UI**: Navigate to http://localhost:9000/docs
2. **Explore endpoints**: Browse the available API endpoints
3. **Test a public endpoint**: Try any public endpoint to verify the service is working
4. **Check authentication**: If testing protected endpoints, use the "Authorize" button to add your JWT token

### Using cURL

```bash
# Test health/status endpoint (if available)
curl http://localhost:9000/

# Test any public endpoint
curl -X GET http://localhost:9000/api/endpoint

# Test protected endpoint with token
curl -X GET http://localhost:9000/api/protected \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## 🎯 Next Steps

Now that you're up and running:

1. **Explore the API**: Check out http://localhost:9000/docs
2. **Explore modules**: Browse `src/modules/` to see available modules
3. **Check common modules**: See `src/common/README.md` for reusable utilities
4. **Run tests**: `npm test` or `make test`
5. **Add your module**: Follow the existing module structure to add new features

---

## 🛠️ Common Commands

```bash
# Development
make start              # Start in dev mode
make start-prod         # Build and start in production mode

# Database
make migrate            # Run migrations
make docker-up          # Start Docker services
make docker-down        # Stop Docker services

# Testing
make test               # Run unit tests
make test-e2e           # Run E2E tests
make test-cov           # Run tests with coverage

# Code Quality
make lint               # Lint code
make format             # Format code
make all                # Run all checks (format, lint, build, test)

# Setup
make setup              # Full setup (install, docker, migrate)
make clean              # Clean build artifacts
```

See `make help` for all available commands.

---

## 🐛 Troubleshooting

### Database Connection Issues

**Problem**: Cannot connect to PostgreSQL

**Solutions**:
```bash
# Check if Docker is running
docker ps

# Check PostgreSQL logs
docker-compose logs postgres

# Restart Docker services
docker-compose restart
```

### Port Already in Use

**Problem**: Port 9000 is already in use

**Solution**: Change `NODE_PORT` in `.env` to a different port (e.g., `9001`)

### Migration Errors

**Problem**: Migrations fail

**Solutions**:
```bash
# Check database is running
docker-compose ps

# Check database connection (replace DB_NAME with your database name from .env)
docker-compose exec postgres psql -U postgres -d digital_wallet_service

# Drop and recreate (⚠️ deletes all data)
docker-compose down -v
docker-compose up -d
npm run migrate
```

### Node Version Mismatch

**Problem**: Wrong Node.js version

**Solution**:
```bash
# If using nvm
nvm use

# Or install the correct version
nvm install v24.13.0
nvm use v24.13.0
```

### Module Not Found Errors

**Problem**: `Cannot find module` errors

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 📁 Project Structure

```
digital-wallet-backend/
├── src/
│   ├── apps/service/          # Main application
│   ├── modules/               # Feature modules (auth, etc.)
│   └── common/                # Shared utilities and modules
├── db/migrations/             # Database migrations
├── test/                      # E2E tests
├── docker-compose.yml         # Docker services
└── Makefile                   # Common commands
```

Key files:
- `src/apps/service/main.ts` - Application entry point
- `src/modules/` - Feature modules (each module contains its own controllers, services, etc.)
- `src/common/` - Reusable modules (logger, database, HTTP client, guards, etc.)

---

## 📚 Additional Resources

- **API Documentation**: http://localhost:9000/docs (when running)
- **Common Modules Guide**: `src/common/README.md`
- **Quick Start Guide**: `src/common/QUICK_START.md`
- **OpenAPI Spec**: `openapi/` (generated automatically in local mode)

---

## 🔐 Authentication

The service uses JWT-based authentication. Check individual module documentation for:
- Default credentials (if any)
- Authentication requirements
- Role-based access control

⚠️ **Important**: Always change default credentials in production!

---

## 📖 API Specification

Full interactive docs (Swagger UI) are served at **http://localhost:9000/docs** when the app is running. The raw OpenAPI 3.0 spec is auto-generated at `openapi/auth-service.yaml` when running with `NODE_ENV=local` (not committed to the repo).

**Auth header** (for endpoints marked `Bearer JWT` below):

```
Authorization: Bearer <jwt-token>
```

### Mobile Auth

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/mobile/auth/google` | Authenticate user with Google OAuth token | Public |
| GET | `/mobile/auth/me` | Get current authenticated user | Bearer JWT |
| PATCH | `/mobile/auth/me` | Update current user profile | Bearer JWT |

### Mobile Cases

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/mobile/cases` | List current user's cases | Bearer JWT |
| POST | `/mobile/cases` | Create a new pre-hospital case | Bearer JWT |
| GET | `/mobile/cases/{id}` | Get case details | Bearer JWT |
| POST | `/mobile/cases/{id}/submit` | Submit a draft case for review | Bearer JWT |
| GET | `/mobile/cases/{caseId}/card` | Get card details (name, last 4 digits, expiry, limit, available balance) | Bearer JWT |
| GET | `/mobile/cases/{id}/card/iframe` | Get secure iframe configuration for displaying card details | Bearer JWT |
| GET | `/mobile/cases/{id}/claim` | Get claim details for a case | Bearer JWT |
| POST | `/mobile/cases/{id}/claim` | Submit a claim for a case | Bearer JWT |

### Mobile Uploads

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/mobile/uploads/presign` | Upload files and get file URLs | Public |

### Ops Auth

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/ops/auth/google` | Authenticate user with Google OAuth token for ops | Public |

### Ops Cases

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/ops/cases` | List all cases for ops review | Bearer JWT |
| GET | `/ops/cases/{id}` | Get full case details for ops | Bearer JWT |
| POST | `/ops/cases/{id}/preapprove` | Preapprove a case and issue a card | Bearer JWT |
| POST | `/ops/cases/{id}/reject` | Reject a submitted case | Bearer JWT |
| POST | `/ops/cases/{id}/settle` | Create settlement for a case | Bearer JWT |

### Ops Claims

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/ops/claims` | List all claims for review | Bearer JWT |
| GET | `/ops/claims/{id}` | Get full claim details with transactions | Bearer JWT |
| POST | `/ops/claims/{id}/review` | Review and validate a claim | Bearer JWT |

### Ops Config

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/ops/config/tiers` | List coverage tiers | Bearer JWT |

### Issuing

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/ops/issuing/cardholders` | Create a new cardholder | Bearer JWT |
| GET | `/ops/issuing/cardholders/me` | Get current user cardholder | Bearer JWT |
| GET | `/ops/issuing/cardholders/{id}` | Get cardholder by ID | Bearer JWT |
| GET | `/ops/issuing/cardholders/{cardholderId}/cards` | Get all cards for a cardholder | Bearer JWT |
| POST | `/ops/issuing/cards` | Create a new virtual card | Bearer JWT |
| GET | `/ops/issuing/cards/{id}` | Get card by ID | Bearer JWT |
| GET | `/ops/issuing/cards/case/{caseId}` | Get card by case ID | Bearer JWT |

### Webhooks

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/webhooks/airwallex` | Receive Airwallex webhook events | HMAC-verified (`AIRWALLEX_WEBHOOK_SECRET`) |

---

## 🚀 Development Workflow

1. **Make changes** to the code
2. **Run tests**: `make test`
3. **Check code quality**: `make lint`
4. **Format code**: `make format`
5. **Test manually**: Use Swagger UI at http://localhost:9000/docs

---

## 💡 Tips for New Developers

1. **Start with Swagger**: The `/docs` endpoint is your best friend for exploring the API
2. **Check the logs**: Application logs show request/response details
3. **Use TypeScript**: The codebase is fully typed - leverage your IDE's autocomplete
4. **Read the common modules**: `src/common/` contains reusable patterns and utilities
5. **Follow the module structure**: New features should follow the existing module pattern in `src/modules/`
6. **Leverage common utilities**: Check `src/common/` before writing new utilities

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

---

## 📦 Tech Stack

- **NestJS** 11.x - Framework
- **TypeScript** 5.x - Language
- **PostgreSQL** 14.9 - Database
- **JWT** - Authentication (when needed)
- **Swagger/OpenAPI** - API Documentation

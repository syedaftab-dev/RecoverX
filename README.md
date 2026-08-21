# RecoverX

RecoverX is an autonomous, bounded AI revenue-recovery platform for merchant checkouts. It monitors checkout friction points (declines, abandonments, errors), reasons on recovery actions, acts within strict guardrails, and maintains an immutable audit log.

---

## 📁 Repository Structure

```text
recoverx/
│
├── frontend/                     # React + Vite Frontend (Chat & Merchant Dashboard :5173)
│
├── backend/
│   ├── gateway/                  # Nginx API Gateway & Reverse Proxy (:8080)
│   ├── services/
│   │   ├── catalog-service/      # Product truth, stock verification & Redis cache (:4001)
│   │   ├── agent-service/        # The Brain: LLM reasoning, bounded action engine (:4002)
│   │   ├── payment-service/      # Razorpay integration & order settlement (:4003)
│   │   └── audit-service/        # Event-driven immutable ledger via Redis Streams (:4004)
│   │
│   └── shared/                   # Cross-cutting constants, types, and event schemas
│
├── docs/                         # Specifications & Architectural docs (SPEC.md)
├── infra/                        # Infrastructure configs (Postgres init, Redis)
├── scripts/                      # Utility scripts (health checks, DB seeding)
├── tests/                        # Unit & Integration test suites
│
├── SPEC.md                       # Canonical system specification
├── docker-compose.yml            # Local development orchestration
├── docker-compose.prod.yml       # Production deployment specification
├── Makefile                      # Standard CLI shortcuts (make dev, make healthcheck)
├── package.json                  # Root monorepo workspace scripts
├── .env.example                  # Environment template
├── .gitignore                    # Git ignore rules
└── README.md
```

---

## 🚀 Quick Start

### 1. Configure Environment
```bash
cp .env.example .env
# Fill in your Razorpay test credentials & OpenAI API key
```

### 2. Boot Containers
```bash
make dev
# or
docker compose up --build
```

### 3. Verify Health & Catalog Endpoints
```bash
make healthcheck
# or
node scripts/healthcheck.js
```

---

## 🌐 Gateway Routing (Port 8080)

| Service | Gateway Route | Container Port | Purpose |
|---|---|---|---|
| **Catalog Service** | `http://localhost:8080/api/catalog/products` | `4001` | List all products (Redis cache) |
| **Catalog Service** | `http://localhost:8080/api/catalog/products/:id` | `4001` | Get single product |
| **Catalog Service** | `http://localhost:8080/api/catalog/stock/check` | `4001` | Real-time stock verification |
| **Agent Service** | `http://localhost:8080/api/agent/health` | `4002` | AI reasoning, tool execution & safety bounds |
| **Payment Service** | `http://localhost:8080/api/payment/health` | `4003` | Razorpay order & webhook processing |
| **Audit Service** | `http://localhost:8080/api/audit/health` | `4004` | Redis Streams ledger |
| **Frontend** | `http://localhost:8080/` | `5173` | Customer chat & merchant dashboard |

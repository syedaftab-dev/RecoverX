# RecoverX

RecoverX is an autonomous, bounded AI revenue-recovery platform for merchant checkouts. It monitors checkout friction points (declines, abandonments, errors), reasons on recovery actions, acts within strict guardrails, and maintains an immutable audit log.

---

## 📁 Repository Structure

```text
recoverx/
│
├── frontend/                     # React + Vite Frontend (Chat & Merchant Dashboard)
│
├── backend/
│   ├── gateway/                  # Nginx API Gateway & Reverse Proxy (:8080)
│   ├── services/
│   │   ├── catalog-service/      # Product truth, stock verification & Redis cache (:4005)
│   │   ├── payment-service/      # Razorpay integration & order settlement (:4001)
│   │   ├── recovery-service/     # AI recovery reasoning & bounded action engine (:4002)
│   │   ├── audit-service/        # Event-driven immutable ledger (:4003)
│   │   └── notification-service/ # Webhook & alert dispatcher (:4004)
│   │
│   └── shared/                   # Cross-cutting constants, types, and event schemas
│
├── docs/                         # Specifications & Architectural docs
├── infra/                        # Infrastructure configs (Postgres init, Redis)
├── scripts/                      # Utility scripts (health checks, DB seeding)
├── tests/                        # Unit & Integration test suites
│
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

## 🌐 Gateway Endpoints (Port 8080)

| Service | Gateway Route | Container Port | Purpose |
|---|---|---|---|
| **Catalog Service** | `http://localhost:8080/api/catalog/products` | `4005` | List all products (with Redis caching) |
| **Catalog Service** | `http://localhost:8080/api/catalog/products/:id` | `4005` | Get single product |
| **Catalog Service** | `http://localhost:8080/api/catalog/stock/check` | `4005` | Real-time stock verification |
| **Payment Service** | `http://localhost:8080/api/payment/health` | `4001` | Razorpay order & webhook processing |
| **Recovery Service** | `http://localhost:8080/api/recovery/health` | `4002` | AI Recovery reasoning & safety bounding |
| **Audit Service** | `http://localhost:8080/api/audit/health` | `4003` | Redis Streams ledger |
| **Notification Service** | `http://localhost:8080/api/notification/health` | `4004` | Merchant/customer notifications |
| **Frontend** | `http://localhost:8080/` | `5173` | Customer chat & merchant dashboard |

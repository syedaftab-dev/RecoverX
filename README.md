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

### 3. Verify Health
```bash
make healthcheck
# or
node scripts/healthcheck.js
```

---

## 🌐 Gateway Endpoints (Port 8080)

| Service | Gateway Route | Container Port |
|---|---|---|
| **Payment Service** | `http://localhost:8080/api/payment/health` | `4001` |
| **Recovery Service** | `http://localhost:8080/api/recovery/health` | `4002` |
| **Audit Service** | `http://localhost:8080/api/audit/health` | `4003` |
| **Notification Service** | `http://localhost:8080/api/notification/health` | `4004` |
| **Frontend** | `http://localhost:8080/` | `5173` |

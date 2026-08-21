# RecoverX — System Specification (SPEC)

## 1. Architecture Overview & Ports

| Service | Internal Port | Gateway Route | Role & Responsibility |
|---|---|---|---|
| **Gateway (Nginx)** | `8080` | `http://localhost:8080` | Edge reverse proxy, rate limiting, request routing |
| **catalog-service** | `4001` | `http://localhost:8080/api/catalog/*` | Product truth (price, stock), Redis caching, inventory checks |
| **agent-service** | `4002` | `http://localhost:8080/api/agent/*` | AI Agent "Brain", standalone tool functions, bounded & gated reasoning |
| **payment-service** | `4003` | `http://localhost:8080/api/payment/*` | Razorpay checkout integration, order creation, webhook settlement |
| **audit-service** | `4004` | `http://localhost:8080/api/audit/*` | Decoupled event consumer via Redis Streams, immutable audit trail |
| **frontend** | `5173` | `http://localhost:8080/` | Customer conversational checkout UI & Merchant Recovery Dashboard |
| **PostgreSQL** | `5432` | `postgres:5432` | Relational persistence for catalog, orders, and audits |
| **Redis** | `6379` | `redis:6379` | Fast caching and Redis Streams event bus |

---

## 2. Service Trust Boundaries

1. **`catalog-service`**: Owns product price and stock truth. No other service can mutate product inventory directly.
2. **`payment-service`**: Sole service permitted to communicate with Razorpay. Agent cannot directly touch money.
3. **`agent-service`**: Contains the reasoning engine. All recovery logic, bounding rules (e.g. discount ≤ 15%), and human-in-the-loop gating thresholds live here.
4. **`audit-service`**: Listens asynchronously to Redis Streams to ensure an immutable, tamper-proof record of every intent, tool invocation, and financial action.

---

## 3. Agent Tool Functions (Day 3 Contract)

Standalone tool functions called by `agent-service`:
1. `get_product(productId)` -> calls `catalog-service`
2. `check_stock(productId, quantity)` -> calls `catalog-service`
3. `apply_discount(orderValue, discountPct, reason)` -> validates bounded limits (≤ 15%), returns discounted total or triggers gating
4. `create_order(cartItems, customerId)` -> calls `payment-service`
5. `retry_payment(paymentId, method)` -> calls `payment-service`
6. `suggest_alternative(productId)` -> queries `catalog-service` for alternatives in same category
7. `escalate_to_human(reason, orderContext)` -> creates gating request pending merchant approval

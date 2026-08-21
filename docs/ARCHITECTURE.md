# RecoverX — System Architecture

## Architecture Diagram

```
                             ┌────────────────────────┐
                             │     Nginx Gateway      │ :8080
                             │   (backend/gateway)    │
                             └───────────┬────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │                       │                       │
                 ▼                       ▼                       ▼
      ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
      │   Payment Service   │ │  Recovery Service   │ │    Audit Service    │
      │        :4001        │ │  (AI Agent) :4002   │ │        :4003        │
      └──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                         │
                                         ▼
                             ┌────────────────────────┐
                             │  Notification Service  │ :4004
                             └───────────┬────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
      ┌─────────────────────┐                         ┌─────────────────────┐
      │     PostgreSQL      │                         │    Redis Streams    │
      │        :5432        │                         │  (Event Bus) :6379  │
      └─────────────────────┘                         └─────────────────────┘
```

## Microservices Breakdown

1. **Gateway (`backend/gateway`)**: Single entry point on `:8080`. Dispatches `/api/<service>` requests and serves frontend.
2. **Payment Service (`backend/services/payment-service`)**: Handles Razorpay test/live checkout interactions, creates orders, processes webhooks.
3. **Recovery Service (`backend/services/recovery-service`)**: Autonomous LLM agent reasoning engine for checkout failure recovery, bounded discount logic, and human-in-the-loop gating.
4. **Audit Service (`backend/services/audit-service`)**: Decoupled consumer listening on Redis Streams to maintain immutable audit trails of all transactions and agent actions.
5. **Notification Service (`backend/services/notification-service`)**: Dispatches recovery notifications via Webhooks, Email, or SMS to customer and merchant.

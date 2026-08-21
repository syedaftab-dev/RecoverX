# RecoverX — Detailed Project Description

## 1. What problem this solves

Merchants lose revenue silently, every day, in three specific moments:

- **Payment declines** — card fails, UPI times out, bank rejects. Customer wanted to buy. Money didn't move. Most merchants do nothing; customer leaves.
- **Cart abandonment** — customer adds items, hesitates, closes tab. No one follows up in the moment it matters.
- **Stock-outs mid-checkout** — item goes out of stock right as customer tries to buy. Dead end, no fallback offered.

Each moment is a **recoverable** revenue event, not a lost one — if something acts fast, explains itself, and stays within safe limits. That "something" today is usually nothing. RecoverX is that something.

## 2. What RecoverX actually is

An AI agent embedded in a merchant's checkout flow that:

1. Runs a normal conversational checkout (customer chats, agent builds cart, checks out)
2. **Watches for revenue-loss moments** in real time (decline, abandonment, stock-out)
3. **Reasons about a recovery action** — retry payment differently, offer a bounded discount, suggest an alternative product, escalate to a human
4. **Never acts outside pre-defined limits** — every discount, every retry, every dollar amount is bounded in code, not just prompted
5. **Explains every decision** in plain language, before and after acting
6. **Logs everything immutably** — a full audit trail a merchant or regulator could inspect
7. **Measures itself** — surfaces a live number: how much revenue it recovered, and at what rate

## 3. Why microservices (not a single app)

- **payment-service** — the only service that talks to Razorpay. Isolating this means a bug in the agent's reasoning can never directly touch money.
- **recovery-service** — the "brain." Only service allowed to reason and decide. Everything it does must be bounded in code.
- **audit-service** — decoupled via the event bus (Redis Streams), so logging can never be skipped or delayed.
- **notification-service** — dispatches alerts and recovery triggers to users & merchants.
- **gateway (Nginx)** — single front door, enforces rate limits on tool calls.

## 4. The core trust mechanism

Three-layer safety model:
1. **Bounded** — hard numeric limits live in code (e.g., discounts ≤15% auto-approve).
2. **Gated** — anything outside the bound pauses and asks a human merchant.
3. **Explainable** — plain-language reasoning stored alongside every action.

# BRT Ticketing Operations Platform — System Architecture

> Your system is essentially:
>
> **A multi-role operational reconciliation platform built around float movement, transaction tracking, remittance, and commission calculation.**

So the architecture must prioritize:

- financial integrity
- auditability
- reconciliation
- scalability
- role isolation
- operational visibility

**NOT just CRUD.**

---

## High-Level Architecture

```
                ┌─────────────────────┐
                │     Frontend UI     │
                │ Web Dashboard/App   │
                └─────────┬───────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │      API Layer      │
                │  Auth + Business    │
                │      Logic          │
                └─────────┬───────────┘
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
┌──────────────┐  ┌───────────────┐  ┌────────────────┐
│ Core Modules │  │Realtime/Event │  │ Reporting &    │
│              │  │Processing     │  │ Analytics      │
└──────┬───────┘  └──────┬────────┘  └────────┬───────┘
       │                 │                    │
       └─────────────────┼────────────────────┘
                         ▼
               ┌──────────────────┐
               │ PostgreSQL DB    │
               │ Ledger + Audit   │
               └──────────────────┘
```

---

## Core Architectural Philosophy

This system should behave like:

- fintech systems
- accounting systems
- operational logistics software

Meaning:

**money movement must be traceable.**

So:

- no silent updates
- no deleting records
- no overwriting financial history

Everything should become:

**append-only operational history**

That's how enterprise systems survive audits.

---

## Main Architecture Layers

---

### 1. Presentation Layer (Frontend)

This is what users interact with.

#### Interfaces

**Ticketer Dashboard**

Shows:

- sales today
- remaining float
- commission estimate
- remittance history
- POS currently using
- sales history

**Supervisor Dashboard**

Shows:

- all assigned ticketers
- float allocations
- total team sales
- outstanding remittance
- daily reconciliation
- POS assignment tracking

**Admin Dashboard**

Shows:

- company-wide sales
- active supervisors
- operational analytics
- unresolved discrepancies
- financial summaries
- audit logs
- performance reports

#### Recommended Frontend Stack

**Web**

- Next.js
- Tailwind CSS
- Shadcn UI

**Why?**

Because:

- fast dashboards
- realtime support
- scalable UI
- role-based rendering
- enterprise-feeling UX

---

### 2. API & Business Logic Layer

This is the brain.

Handles:

- validation
- reconciliation
- permissions
- calculations
- transaction processing

#### Recommended Backend

**Option 1 (Best Long-Term)**

NestJS

Why?

- modular architecture
- enterprise-ready
- dependency injection
- scalable structure
- cleaner for large systems

**Option 2 (Faster MVP)**

Express.js

But honestly?
For THIS system:

> NestJS is the better architectural choice.

You're building operational infrastructure, not a portfolio app.

---

### 3. Authentication & Authorization Layer

VERY important.

#### Roles

- ADMIN
- SUPERVISOR
- TICKETER
- AUDITOR

#### Permission System

Use:

**RBAC (Role-Based Access Control)**

Example:

| Action | Ticketer | Supervisor | Admin |
| :--- | :---: | :---: | :---: |
| Allocate Float | ❌ | ✅ | ✅ |
| View All Reports | ❌ | Partial | ✅ |
| Remit Money | ✅ | ✅ | ✅ |
| Reverse Transaction | ❌ | ❌ | ✅ |

#### Auth Stack

- JWT access tokens
- refresh tokens
- bcrypt password hashing
- optional OTP later

---

### 4. Core Operational Modules

Now the important part.

---

#### MODULE A — Float Management Module

Tracks:

- company float
- supervisor float
- ticketer float
- carry-over balances

Core responsibility:

> money allocation tracking

---


#### MODULE C — Remittance Module

Tracks:

- cash remittance
- transfer remittance
- pending remittance
- carry-over debt

Critical for reconciliation.

---

#### MODULE D — Reconciliation Engine

Probably the most important module.

Calculates:

```
Allocated Float
-
Top-Up Transactions
-
Cash Remitted
=
Variance
```

This module detects:

- discrepancies
- missing remittance
- inconsistent balances

> This is the system's intelligence layer.

---

#### MODULE E — Commission Engine

Tracks:

- commission percentage
- sales-based earnings
- deductions
- fines
- expected salary

This solves salary disputes automatically.

---

#### MODULE F — POS Device Management

Tracks:

- POS assigned
- active device
- multiple POS usage
- device switching
- POS transaction activity

VERY important since ticketers may use multiple POS devices.

---

#### MODULE G — Audit & Activity Logs

Tracks EVERYTHING.

Example:

- Supervisor allocated ₦100,000
- Ticketer remitted ₦50,000
- POS switched
- Commission recalculated

This becomes your:

> forensic investigation layer

Enterprise systems ALWAYS need this.

---

#### MODULE H — Reporting & Analytics

Generates:

- daily reports
- sales trends
- remittance summaries
- performance analytics
- commission reports
- operational dashboards

---

### 5. Database Architecture

**Why PostgreSQL?**

Because your system requires:

- transactions
- relational integrity
- financial consistency
- complex reporting
- ACID compliance


**Users**
`users`

Stores:

- ticketers
- supervisors
- management

**Float Ledger**
`float_ledger`

Tracks ALL float movement.

> This is one of your most important tables.

**Transactions**
`topup_transactions`

Stores commuter top-ups.

**Remittances**
`remittances`

Stores submitted money.

**Commission Records**
`commission_records`

Tracks salary calculations.

**POS Devices**
`pos_devices`

Tracks hardware assignment.

**Audit Logs**
`audit_logs`

Tracks system activity.

---

### 6. Realtime/Event System

Important for dashboards.

#### Use Cases

Realtime updates for:

- new sales
- remittance submission
- supervisor monitoring
- live dashboards

#### Recommended

**Socket.IO**

---

### 7. Queue/Event Processing Layer

As system grows:

- reconciliation jobs
- report generation
- notifications
- salary calculations

should move to background workers.

#### Recommended

- Redis
- BullMQ

#### Why Queues Matter

Example:

```
Transaction happens
     ↓
Job enters queue
     ↓
Commission recalculated
     ↓
Dashboard updated
```

Much cleaner architecture.

---

### 8. Notification System

Later:

- SMS alerts
- email reports
- discrepancy warnings
- low float alerts

---

---

## Suggested Improvements & Additions

> The following are architectural suggestions to strengthen the system beyond the original design. These are additive — they do not replace anything above.

---

### A. Database: Soft Deletes Over Hard Deletes

Every table that touches money or operations should have a `deleted_at` timestamp column instead of using `DELETE`. This aligns with the append-only philosophy and allows recovery of "removed" data.

```sql
deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
```

---

### B. Float Ledger: Double-Entry Accounting Model

Instead of a single `float_ledger` table with balance columns, consider a **double-entry ledger** pattern where every float movement creates **two rows** (a debit and a credit). This mirrors how accounting software works and makes reconciliation mathematically verifiable.

```
DR: company_float   100,000
CR: supervisor_float 100,000
```

This makes the Reconciliation Engine far more reliable.

---

### C. Idempotency Keys for Transactions

Every API endpoint that modifies financial data (allocate float, record remittance, submit top-up) should accept an **idempotency key** to prevent duplicate operations from network retries.

```
POST /api/remittance
Headers: X-Idempotency-Key: <uuid>
```

---

### D. Reconciliation Engine: Scheduled Triggers (Cron)

The Reconciliation Engine should not only run on-demand. Use BullMQ's cron scheduler to run reconciliation automatically:

- End of day (23:59) — per ticketer
- Start of day (06:00) — carry-over balance calculation
- On supervisor close — team reconciliation

---

### E. Audit Logs: Structured JSON Diff

Audit log entries should store a `before` and `after` JSON snapshot of the changed entity, not just a text description. This enables forensic comparison.

```json
{
  "action": "FLOAT_ALLOCATED",
  "actor_id": "supervisor_uuid",
  "target_id": "ticketer_uuid",
  "before": { "balance": 0 },
  "after": { "balance": 100000 },
  "timestamp": "2026-05-15T10:00:00Z"
}
```

---

### F. API Rate Limiting & Throttling

Since this is a financial platform, protect all mutation endpoints:

- Per-user rate limits on remittance and float endpoints.
- NestJS `ThrottlerGuard` for simple IP-based throttling.
- Redis-backed rate limiting for distributed deployments.

---

### G. Environment Split: Dev / Staging / Production

Define three environments from day one:

| Environment | Purpose |
| :--- | :--- |
| `development` | Local development and feature work |
| `staging` | UAT and QA before release |
| `production` | Live operational data |

Use separate `.env` files and separate PostgreSQL databases per environment. **Never run migrations directly on production** without staging validation first.

---

### H. Error Budget & Alerting (Future)

Once the system is live, integrate with:

- **Sentry** — for backend error tracking
- **Grafana + Prometheus** — for operational metrics (float velocity, transaction throughput)
- **PagerDuty / Slack Alerts** — for critical discrepancy or low float alerts

---

*Last updated: 2026-05-15*

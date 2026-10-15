# TicketHub — System Design Document

## 1. Requirements

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-1 | Users can register and log in to their accounts. |
| FR-2 | Users can browse upcoming events (concerts, sports, theater). |
| FR-3 | Users can view the seat map for a specific event and see which seats are available, held, or sold. |
| FR-4 | Users can select seats and place them in a temporary hold (10-minute reservation). |
| FR-5 | Users can complete payment for held seats. |
| FR-6 | Users can view their purchased tickets (order history). |
| FR-7 | Admins can create events, configure venues, and set ticket prices. |
| FR-8 | Admins can view sales reports and revenue dashboards. |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | **Speed** — Page loads must be fast even under heavy load. | Browse pages < 200 ms; seat map render < 500 ms. |
| NFR-2 | **Correctness** — A seat must never be sold twice. Double-booking must be impossible. | 0 double-bookings. |
| NFR-3 | **Fairness** — All users must have an equal chance of getting tickets during a popular sale. No queue-jumping. | First-come-first-served with randomized ordering. |
| NFR-4 | **Availability** — The system must stay online during peak sales. | 99.95% uptime. |
| NFR-5 | **Scalability** — The system must handle the "big sale" scenario without degradation. | 200,000 concurrent users in the first 10 minutes. |
| NFR-6 | **Security** — Payment data must be encrypted; no PII leakage. | PCI-DSS compliant payment flow. |

---

## 2. Traffic Estimates

### Normal Day

| Metric | Value |
|--------|-------|
| Registered users | 2,000,000 |
| Daily visitors | 50,000 |
| Pages per visitor | 10 |
| Total page views/day | 500,000 |
| Peak hours (assume 8h) | — |
| Avg requests/second | 500,000 / (8 × 3,600) ≈ **17 req/s** |
| Peak requests/second (2× avg) | **~35 req/s** |
| Tickets sold/day | 5,000 |
| Transactions/second | 5,000 / 86,400 ≈ **0.06 tx/s** |

### Big Sale (Popular Concert)

| Metric | Value |
|--------|-------|
| Users attempting purchase | 200,000 |
| Time window | 10 minutes (600 seconds) |
| Total seats available | 20,000 |
| Actions per user (browse + select + pay) | ~5 requests |
| Total requests in 10 min | 1,000,000 |
| Peak requests/second | 1,000,000 / 600 ≈ **1,667 req/s** |
| Concurrent hold attempts | 200,000 users competing for 20,000 seats |
| Seat reservation rate | 20,000 / 600 ≈ **33 seats/sec** |

### Comparison

| Metric | Normal Day | Big Sale | Ratio |
|--------|-----------|----------|-------|
| Requests/second | ~35 | ~1,667 | **48×** |
| Concurrent users | ~1,000 | 200,000 | **200×** |
| Seat reservations/sec | ~0.06 | ~33 | **550×** |

The big sale creates a **48× spike in request volume** and a **200× spike in concurrency**. The system must be designed for the peak, not the average.

---

## 3. API Design

### Endpoints

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | `GET` | `/api/events` | Browse events with filters (date, genre, city). Returns paginated list. |
| 2 | `GET` | `/api/events/:id/seats` | View the seat map for an event. Returns seat status (available/held/sold) and pricing tier. |
| 3 | `POST` | `/api/holds` | Place a temporary hold on selected seats. Body: `{ eventId, seatIds[] }`. Returns hold token and expiry (10 min). |
| 4 | `POST` | `/api/orders` | Complete purchase. Body: `{ holdToken, paymentMethodId }`. Converts hold to confirmed order. |
| 5 | `GET` | `/api/users/:id/orders` | View order history and tickets for a user. |

### Additional Endpoints (bonus)

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 6 | `DELETE` | `/api/holds/:token` | Release a hold early (cancel). |
| 7 | `GET` | `/api/events/:id` | Get event details (venue, date, artist, description). |

### API Flow

```
User → GET /events → GET /events/:id/seats → POST /holds → POST /orders → GET /users/:id/orders
```

---

## 4. Data Model

### Tables

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| name | VARCHAR(100) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### `events`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| title | VARCHAR(255) | NOT NULL |
| venue_id | UUID | FOREIGN KEY → venues.id |
| event_date | TIMESTAMP | NOT NULL |
| sale_start | TIMESTAMP | NOT NULL (when tickets go on sale) |
| status | ENUM('draft','on_sale','sold_out','completed') | DEFAULT 'draft' |

#### `seats`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| event_id | UUID | FOREIGN KEY → events.id, NOT NULL |
| label | VARCHAR(10) | NOT NULL (e.g., "A12") |
| row_label | VARCHAR(5) | NOT NULL |
| price_cents | INTEGER | NOT NULL |
| status | ENUM('available','held','sold') | DEFAULT 'available' |
| UNIQUE(event_id, label) | | |

#### `orders`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | FOREIGN KEY → users.id, NOT NULL |
| event_id | UUID | FOREIGN KEY → events.id, NOT NULL |
| total_cents | INTEGER | NOT NULL |
| status | ENUM('pending','confirmed','cancelled') | DEFAULT 'pending' |
| created_at | TIMESTAMP | DEFAULT NOW() |
| payment_id | VARCHAR(255) | (from payment provider) |

#### `order_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| order_id | UUID | FOREIGN KEY → orders.id, NOT NULL |
| seat_id | UUID | FOREIGN KEY → seats.id, NOT NULL |
| price_cents | INTEGER | NOT NULL |

### Relationships

```
users 1 ──── N orders
events 1 ──── N seats
events 1 ──── N orders
orders 1 ──── N order_items
seats 1 ──── 1 order_items (each seat belongs to at most one order)
```

---

## 5. Preventing Double-Booking

This is the most critical correctness requirement. Two users must never end up with the same seat.

### Strategy: Optimistic Concurrency with Database Constraints

1. **Unique constraint on seat assignment:** The `order_items` table has a `UNIQUE(seat_id)` constraint. Even if two transactions try to insert simultaneously, the database will reject one.

2. **Atomic hold with row-level locking:** When a user calls `POST /holds`, the API executes:

```sql
BEGIN TRANSACTION;

-- Lock the specific seat rows
SELECT * FROM seats
WHERE event_id = $1 AND id = ANY($2) AND status = 'available'
FOR UPDATE SKIP LOCKED;

-- If any requested seat is not available, abort immediately
-- (SKIP LOCKED means another transaction already grabbed it)

UPDATE seats SET status = 'held'
WHERE id = ANY($3) AND status = 'available';

INSERT INTO holds (token, seat_ids, expires_at)
VALUES ($4, $3, NOW() + INTERVAL '10 minutes');

COMMIT;
```

3. **`FOR UPDATE SKIP LOCKED`** is the key mechanism:
   - It locks the selected rows so no other transaction can modify them.
   - `SKIP LOCKED` means if another transaction already locked a row, this transaction skips it instead of waiting. This prevents deadlocks and ensures fairness.
   - If a seat is already held or sold, the SELECT returns no row for it, and the transaction rolls back.

4. **Hold expiration:** A background job runs every 30 seconds to release expired holds:
```sql
UPDATE seats SET status = 'available'
WHERE status = 'held' AND id IN (
  SELECT seat_id FROM holds WHERE expires_at < NOW()
);
```

5. **Payment confirmation is also transactional:**
```sql
BEGIN TRANSACTION;

UPDATE seats SET status = 'sold'
WHERE id = ANY($1) AND status = 'held';

INSERT INTO orders (...) VALUES (...);
INSERT INTO order_items (...) VALUES (...);

DELETE FROM holds WHERE token = $2;

COMMIT;
```

### Why This Works

- **No two transactions can hold the same seat** because `FOR UPDATE SKIP LOCKED` serializes access to each seat row.
- **No two transactions can buy the same seat** because the `UNIQUE(seat_id)` constraint on `order_items` acts as a final safety net.
- **Fairness** is ensured because `SKIP LOCKED` gives priority to whichever transaction acquired the lock first — no retry loops that could favor faster clients.

---

## 6. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS (200K)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   CDN +      │
                    │   WAF        │ ← Static assets, DDoS protection
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Load       │
                    │   Balancer   │ ← Round-robin, health checks
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──┐  ┌──────▼──┐  ┌──────▼──┐
       │ API      │  │ API      │  │ API      │  ← Stateless API servers
       │ Server 1 │  │ Server 2 │  │ Server N │     (auto-scaled)
       └──────┬──┘  └──────┬──┘  └──────┬──┘
              │            │            │
              └────────────┼────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──┐  ┌──────▼──┐  ┌──────▼──────┐
       │ Redis    │  │ Primary  │  │ Read        │
       │ Cluster  │  │ Postgres │  │ Replicas    │
       │          │  │          │  │ (2-3)       │
       └──────────┘  └──────────┘  └─────────────┘
              │            │
       ┌──────▼──┐  ┌──────▼──────┐
       │ Queue    │  │ Payment     │
       │ (SQS/    │  │ Gateway     │
       │  Redis)  │  │ (Stripe)    │
       └──────┬──┘  └─────────────┘
              │
       ┌──────▼──────┐
       │ Worker       │ ← Hold expiration, notifications
       │ Processes    │
       └─────────────┘
```

### Component Explanations

| Component | Purpose |
|-----------|---------|
| **CDN + WAF** | Serves static assets (seat map images, JS bundles) close to users. WAF blocks DDoS and malicious traffic before it reaches our servers. |
| **Load Balancer** | Distributes incoming requests across API servers. Performs health checks and removes unhealthy instances. |
| **API Servers (stateless)** | Handle all business logic. Stateless so they can be horizontally scaled. During a big sale, auto-scaling adds instances based on CPU/request metrics. |
| **Redis Cluster** | Caches event listings and seat maps (read-heavy). Also stores session data and acts as a rate limiter (e.g., max 5 hold attempts per user per minute). |
| **Primary PostgreSQL** | Handles all writes (holds, orders). Configured with connection pooling (PgBouncer) to handle thousands of concurrent connections. |
| **Read Replicas** | Serve all `GET` requests (browse events, view seat maps). Offloads the primary so it can focus on writes. |
| **Message Queue** | Decouples non-critical work: sending confirmation emails, updating analytics, processing hold expirations. Prevents these from blocking the critical path. |
| **Payment Gateway** | External service (Stripe). We use tokenized payments — we never handle raw card data. |
| **Worker Processes** | Consume messages from the queue. Handle hold expiration (releasing seats after 10 min), email notifications, and reporting. |

### How It Survives the Big Sale

1. **Read scaling:** 90% of traffic during a sale is reads (browsing, viewing seats). Read replicas absorb this. The CDN caches event pages.
2. **Write scaling:** Only 20,000 seats will be sold, so writes are bounded. PgBouncer manages connection pooling so the primary isn't overwhelmed.
3. **Fairness via queue:** For extremely popular events, we implement a virtual waiting room. Users are placed in a FIFO queue (stored in Redis) and admitted in batches of 1,000 every 5 seconds. This prevents a thundering herd on the database.
4. **Rate limiting:** Redis-based rate limiting prevents bots from hogging seats. Each user is limited to 4 seats per event.
5. **Circuit breakers:** If the payment gateway is slow, circuit breakers prevent cascading failures. Users see "processing" and are notified when complete.
6. **Auto-scaling:** API servers scale from 4 to 50+ instances based on request rate. The load balancer distributes traffic evenly.

---

## 7. Trade-offs

### Trade-off 1: Optimistic Locking vs. Pessimistic Locking

**Choice:** We use `FOR UPDATE SKIP LOCKED` (pessimistic row-level locking) for seat holds.

**Alternative:** Optimistic locking with a version column — check seat status, attempt update, retry if conflict.

**Why pessimistic:** In a high-contention scenario (200K users, 20K seats), optimistic locking would cause massive retry storms. Most transactions would fail and retry, creating a feedback loop that makes things worse. Pessimistic locking with `SKIP LOCKED` gives immediate feedback: if a seat is taken, you know right away and can pick another.

**Cost:** Pessimistic locking holds database connections longer. We mitigate this with connection pooling and keeping transactions short.

### Trade-off 2: Caching Seat Maps vs. Real-time Accuracy

**Choice:** We cache seat maps in Redis with a 2-second TTL.

**Alternative:** Always read from the database for 100% accuracy.

**Why cache:** During a big sale, the seat map endpoint would be hit thousands of times per second. Reading from the database every time would overwhelm it. A 2-second cache means users see seat availability that is at most 2 seconds stale — acceptable because the actual hold operation always checks the database.

**Cost:** Users might try to select a seat that was just taken. The hold API will reject it, and the user picks another. This is a small UX friction that prevents system collapse.

### Trade-off 3: Synchronous Payment vs. Async Payment

**Choice:** Payment is synchronous within the order transaction.

**Alternative:** Create the order as "pending," process payment asynchronously, confirm later.

**Why synchronous:** If we go async, the seat remains in limbo. Other users can't buy it, but the buyer might never complete payment. During a big sale with only 20K seats, we can't afford to have seats locked by flaky async processes. Synchronous payment ensures that if payment fails, the seat is immediately released.

**Cost:** If the payment gateway is slow (e.g., 3 seconds), the API request takes 3+ seconds. We mitigate this with timeouts and a clean "payment failed, try again" UX.

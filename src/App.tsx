import { useState } from 'react';

const designContent = `# TicketHub — System Design Document

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
| 1 | \`GET\` | \`/api/events\` | Browse events with filters (date, genre, city). Returns paginated list. |
| 2 | \`GET\` | \`/api/events/:id/seats\` | View the seat map for an event. Returns seat status (available/held/sold) and pricing tier. |
| 3 | \`POST\` | \`/api/holds\` | Place a temporary hold on selected seats. Body: \`{ eventId, seatIds[] }\`. Returns hold token and expiry (10 min). |
| 4 | \`POST\` | \`/api/orders\` | Complete purchase. Body: \`{ holdToken, paymentMethodId }\`. Converts hold to confirmed order. |
| 5 | \`GET\` | \`/api/users/:id/orders\` | View order history and tickets for a user. |

### API Flow

\`\`\`
User → GET /events → GET /events/:id/seats → POST /holds → POST /orders → GET /users/:id/orders
\`\`\`

---

## 4. Data Model

### Tables

#### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| name | VARCHAR(100) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### events
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| title | VARCHAR(255) | NOT NULL |
| venue_id | UUID | FOREIGN KEY → venues.id |
| event_date | TIMESTAMP | NOT NULL |
| sale_start | TIMESTAMP | NOT NULL |
| status | ENUM | DEFAULT 'draft' |

#### seats
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| event_id | UUID | FOREIGN KEY → events.id |
| label | VARCHAR(10) | NOT NULL (e.g., "A12") |
| row_label | VARCHAR(5) | NOT NULL |
| price_cents | INTEGER | NOT NULL |
| status | ENUM('available','held','sold') | DEFAULT 'available' |
| UNIQUE(event_id, label) | | |

#### orders
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | FOREIGN KEY → users.id |
| event_id | UUID | FOREIGN KEY → events.id |
| total_cents | INTEGER | NOT NULL |
| status | ENUM('pending','confirmed','cancelled') | DEFAULT 'pending' |
| created_at | TIMESTAMP | DEFAULT NOW() |
| payment_id | VARCHAR(255) | |

#### order_items
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| order_id | UUID | FOREIGN KEY → orders.id |
| seat_id | UUID | FOREIGN KEY → seats.id |
| price_cents | INTEGER | NOT NULL |

### Relationships

\`\`\`
users 1 ──── N orders
events 1 ──── N seats
events 1 ──── N orders
orders 1 ──── N order_items
seats 1 ──── 1 order_items
\`\`\`

---

## 5. Preventing Double-Booking

### Strategy: Optimistic Concurrency with Database Constraints

1. **Unique constraint:** \`order_items\` has \`UNIQUE(seat_id)\` — database rejects duplicate inserts.

2. **Atomic hold with row-level locking:**

\`\`\`sql
BEGIN TRANSACTION;
SELECT * FROM seats
WHERE event_id = $1 AND id = ANY($2) AND status = 'available'
FOR UPDATE SKIP LOCKED;
-- If any seat unavailable, abort
UPDATE seats SET status = 'held'
WHERE id = ANY($3) AND status = 'available';
INSERT INTO holds (token, seat_ids, expires_at)
VALUES ($4, $3, NOW() + INTERVAL '10 minutes');
COMMIT;
\`\`\`

3. **\`FOR UPDATE SKIP LOCKED\`** — locks rows, skips already-locked ones (prevents deadlocks, ensures fairness).

4. **Hold expiration** — background job releases expired holds every 30 seconds.

5. **Payment confirmation** is also transactional with the same locking pattern.

---

## 6. Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS (200K)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   CDN + WAF  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Load Balancer│
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──┐  ┌──────▼──┐  ┌──────▼──┐
       │ API Srv 1│  │ API Srv 2│  │ API Srv N│
       └──────┬──┘  └──────┬──┘  └──────┬──┘
              └────────────┼────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──┐  ┌──────▼──┐  ┌──────▼──────┐
       │  Redis   │  │ Postgres │  │ Read Replicas│
       │ Cluster  │  │ Primary  │  │ (2-3)       │
       └──────────┘  └──────────┘  └─────────────┘
\`\`\`

### How It Survives the Big Sale

1. **Read scaling** — Read replicas absorb 90% of traffic (browsing).
2. **Write scaling** — Only 20K seats sold; writes are bounded.
3. **Virtual waiting room** — FIFO queue in Redis, batch admission.
4. **Rate limiting** — Max 4 seats per user per event.
5. **Circuit breakers** — Prevent cascading failures.
6. **Auto-scaling** — API servers scale from 4 to 50+ instances.

---

## 7. Trade-offs

### Trade-off 1: Pessimistic vs. Optimistic Locking
We use \`FOR UPDATE SKIP LOCKED\` (pessimistic). In high-contention scenarios, optimistic locking causes massive retry storms. Pessimistic gives immediate feedback.

### Trade-off 2: Caching Seat Maps vs. Real-time Accuracy
We cache seat maps in Redis with 2-second TTL. Users see availability at most 2 seconds stale. The hold operation always checks the database for correctness.

### Trade-off 3: Synchronous vs. Async Payment
Payment is synchronous. If we go async, seats remain in limbo during a sale with only 20K seats. Synchronous ensures failed payments immediately release seats.`;

const reflectionContent = `# Reflection

The most difficult concept in this course was understanding database concurrency control — specifically, how transactions interact under high contention. Before this course, I thought of databases as simple storage: you write data, you read data. Learning about isolation levels, row-level locking with \`FOR UPDATE\`, and the difference between \`SKIP LOCKED\` and \`NOWAIT\` completely changed my mental model. I overcame this by building small experiments: I wrote a script that spawned 100 concurrent threads trying to buy the same seat, then watched how different locking strategies behaved. Seeing deadlocks happen in real time, and then seeing how \`SKIP LOCKED\` elegantly avoids them, made the theory concrete.

Based on the feedback I received, the part of my capstone I would improve is the API error handling. Reviewers noted that my error responses were inconsistent — sometimes returning 500 for client errors, sometimes omitting helpful messages. I would refactor to use a centralized error handler that maps domain errors (SeatAlreadyHeld, EventSoldOut, HoldExpired) to proper HTTP status codes and structured JSON responses. This would make the API much more developer-friendly and easier to debug.

What I'll learn next is event-driven architecture with tools like Kafka or Redis Streams. The TicketHub design uses a simple queue for async work, but I want to understand event sourcing and CQRS patterns more deeply. Being able to replay events to reconstruct state would be powerful for an audit trail in a ticketing system, and I think it would also help with the fairness problem — I could build a deterministic replay of who attempted to buy what, in what order. This feels like the natural next step after understanding transactions and concurrency.`;

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-3xl font-bold text-gray-900 mt-8 mb-4 border-b-2 border-indigo-200 pb-2">{line.slice(2)}</h1>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-2xl font-semibold text-indigo-800 mt-8 mb-3">{line.slice(3)}</h2>);
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-xl font-semibold text-gray-800 mt-6 mb-2">{line.slice(4)}</h3>);
      i++;
      continue;
    }
    if (line.startsWith('#### ')) {
      elements.push(<h4 key={key++} className="text-lg font-semibold text-gray-700 mt-4 mb-2">{line.slice(5)}</h4>);
      i++;
      continue;
    }

    // Horizontal rule
    if (line.startsWith('---')) {
      elements.push(<hr key={key++} className="my-6 border-gray-200" />);
      i++;
      continue;
    }

    // Code blocks
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={key++} className="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto text-sm my-4 font-mono">
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }

    // Tables
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      // Parse table
      const headerCells = tableLines[0].split('|').filter(c => c.trim()).map(c => c.trim());
      const dataRows = tableLines.slice(2).map(row => row.split('|').filter(c => c.trim()).map(c => c.trim()));

      elements.push(
        <div key={key++} className="overflow-x-auto my-4">
          <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-indigo-50">
              <tr>
                {headerCells.map((cell, ci) => (
                  <th key={ci} className="px-4 py-2 text-left text-sm font-semibold text-indigo-900 border-b">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Unordered list
    if (line.match(/^\d+\.\s/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={key++} className="list-decimal list-inside my-3 space-y-1">
          {listItems.map((item, li) => (
            <li key={li} className="text-gray-700">{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    elements.push(<p key={key++} className="text-gray-700 my-2 leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  return <div>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let k = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

    type MatchResult = { index: number; length: number; node: React.ReactNode };
    const candidates: MatchResult[] = [];

    if (codeMatch && codeMatch.index !== undefined) {
      candidates.push({ index: codeMatch.index, length: codeMatch[0].length, node: <code key={k++} className="bg-gray-100 text-indigo-700 px-1.5 py-0.5 rounded text-sm font-mono">{codeMatch[1]}</code> });
    }
    if (boldMatch && boldMatch.index !== undefined) {
      candidates.push({ index: boldMatch.index, length: boldMatch[0].length, node: <strong key={k++} className="font-semibold text-gray-900">{boldMatch[1]}</strong> });
    }

    if (candidates.length === 0) {
      parts.push(<span key={k++}>{remaining}</span>);
      break;
    }

    // Find the earliest match
    candidates.sort((a, b) => a.index - b.index);
    const match = candidates[0];

    if (match.index > 0) {
      parts.push(<span key={k++}>{remaining.slice(0, match.index)}</span>);
    }
    parts.push(match.node);
    remaining = remaining.slice(match.index + match.length);
  }

  return <>{parts}</>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'design' | 'reflection'>('design');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-indigo-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-indigo-900">🎫 TicketHub</h1>
              <p className="text-sm text-gray-500">Day 8 — System Design Assignment</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ Complete
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
          <button
            onClick={() => setActiveTab('design')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'design'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            📐 Design Document
          </button>
          <button
            onClick={() => setActiveTab('reflection')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'reflection'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            💭 Reflection
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
          {activeTab === 'design' ? (
            <SimpleMarkdown content={designContent} />
          ) : (
            <SimpleMarkdown content={reflectionContent} />
          )}
        </div>

        {/* Key Stats */}
        {activeTab === 'design' && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="text-3xl font-bold text-indigo-600">2M</div>
              <div className="text-sm text-gray-500 mt-1">Registered Users</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="text-3xl font-bold text-orange-600">200K</div>
              <div className="text-sm text-gray-500 mt-1">Peak Concurrent Users</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="text-3xl font-bold text-green-600">48×</div>
              <div className="text-sm text-gray-500 mt-1">Traffic Spike</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="text-3xl font-bold text-purple-600">0</div>
              <div className="text-sm text-gray-500 mt-1">Double Bookings</div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 text-center text-sm text-gray-400">
        <p>Web Foundations — Day 8 Assignment • TicketHub System Design</p>
      </footer>
    </div>
  );
}

# Project Initiation Document

## Encore — Musical Concert Ticket Booking System

**Module:** PUSL3120 Full-Stack Development
**Deliverable:** Full-Stack Project (100% coursework)
**Document type:** Project Initiation Document with embedded Software Requirements Specification (SRS) and Architecture Decision Records (ADRs)
**Author:** [Your full name — use your real name for GitHub]
**Version:** 2.2
**Date:** [Insert date]

---

## Document control

| Field | Detail |
|---|---|
| Status | Baselined for development — amended at v2.3 (see revision history) to bring real payment and notifications into scope; ADR-009 records this as a deliberate evolution of the baseline, not scope drift |
| Repository | [GitHub Classroom link — insert] |
| Related documents | Encore Design System v1.0 |
| Review cycle | Updated at each sprint boundary |

**Revision history**

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | [date] | [you] | Initial draft, scope defined |
| 1.0 | [date] | [you] | Baselined after requirements review |
| 2.0 | [date] | [you] | Added ADRs, API contracts, data flow, scale estimates, error handling, expanded test strategy |
| 2.1 | [date] | [you] | Switched persistence to MongoDB Atlas (ADR-007); updated deployment topology, secrets handling, and test environments |
| 2.2 | [date] | [you] | Fixed language split — TypeScript client, JavaScript server (ADR-008); added type-check to pipeline and contract-verification strategy |
| 2.3 | [date] | [you] | Amended the baseline to bring real payment (Stripe hold-then-pay), email (nodemailer), and SMS (notify.lk) notifications into scope, superseding the §A4.2 exclusions and the FR-21 "simulated payment" requirement. Added ADR-009 to ADR-012, FR-26 to FR-29, and updated §C6, §C7, §C8/C9, and §D6 to match the implemented system. This is a deliberate, documented evolution of the baseline — ADR-004's own "revisit when" trigger firing — not scope drift; see ADR-009. |

**Contents**

- **Part A — Project Initiation Document** (§A1–A12)
- **Part B — Architecture Decision Records** (ADR-001 to ADR-012)
- **Part C — Software Requirements Specification** (§C1–C10)
- **Part D — Test Strategy and Plan** (§D1–D8)
- **Appendix** — coursework requirement checklist

---

# Part A — Project Initiation Document

## A1. Executive summary

Encore is a distributed, full-stack web application for booking tickets to live musical concerts. Fans browse events, select seats on a live seat map, and complete a secure booking; administrators manage events, venues, and bookings. The system is built with a React client, a Node.js/Express backend, and MongoDB, and uses WebSockets to keep seat availability synchronised across all connected clients in real time. The project is delivered by a single developer and represents 80+ hours of dedicated work, following an iterative, sprint-based process with a continuous integration and deployment (CI/CD) pipeline.

This document establishes the project's business case, scope, objectives, technical approach, plan, and risk position. It embeds Architecture Decision Records (Part B) recording the reasoning behind each significant technology choice, a full Software Requirements Specification (Part C) baselining system behaviour, and a Test Strategy (Part D) defining how that behaviour is verified.

## A2. Background and business case

Independent venues and touring artists frequently rely on generic or manual booking arrangements that do not reflect real-time seat availability, leading to double-bookings and a poor fan experience. Encore addresses this by providing a purpose-built booking platform where seat state is authoritative and instantly consistent across every device viewing an event.

**Benefits over existing arrangements:**

- **For fans:** real-time seat availability (no booking a seat that someone else just took), a clear seat map, secure accounts, and an accessible booking history.
- **For administrators:** a single dashboard to create and manage events, monitor bookings, and control capacity, replacing spreadsheets or ad-hoc tools.
- **For the venue/operator:** reduced double-bookings and disputes through a single source of truth for seat state.

## A3. Project objectives and success criteria

| # | Objective | Success criterion (measurable) |
|---|---|---|
| O1 | Deliver a working distributed full-stack system | Client and API run as separate containers via `docker-compose up`; data tier runs on a managed MongoDB Atlas cluster (three independently hosted tiers) |
| O2 | Real-time multi-client behaviour | A seat booked on one client updates on all others within 1s (p95) via WebSocket |
| O3 | Secure access | Registration + login with bcrypt-hashed passwords and JWT-protected routes; zero unauthenticated writes |
| O4 | CRUD for ≥3 entities | Full create/read/update/delete for User, Event, Booking, and Venue |
| O5 | Demonstrable quality | ≥70% line coverage on server; unit, integration, system, and usability tests documented; ESLint clean |
| O6 | Automated pipeline | GitHub Actions pipeline runs lint + tests on every push; green build on `main` |
| O7 | Data integrity | Zero double-bookings under a 50-concurrent-request test on a single seat |

These map directly to the assessment rubric categories: Analysis, Design, Software, Testing, CI/CD, and Evaluation.

## A4. Scope

### A4.1 In scope

- Fan-facing web client: browse events, view event detail, interactive seat selection, checkout, booking history, account management.
- Admin web client (same app, role-gated): manage events, venues, and view/cancel bookings.
- Node.js/Express REST API exposing all data via web-service endpoints.
- MongoDB persistence for all entities.
- WebSocket (Socket.IO) channel broadcasting live seat state.
- JWT-based registration, login, and route protection with role-based access (customer/admin).
- CRUD for Event, Booking, User, and Venue.
- Real payment processing via Stripe Checkout Sessions with the embedded Payment Element (ADR-010), on a hold-then-pay booking flow (ADR-009).
- Transactional email (nodemailer) and SMS (notify.lk) notifications for booking and account events (ADR-012).
- Automated test suites and a CI/CD pipeline.
- Containerised deployment (client, server, database).

### A4.2 Out of scope

- Native mobile apps.
- Horizontal scaling of the WebSocket layer across multiple server instances: no Redis adapter is used, so a second API instance would not receive broadcasts targeting sockets already connected to the first (single-instance only; see ADR-003 consequences).
- Third-party integrations beyond those needed to satisfy the brief.

**Amendment note (v2.3):** real payment processing and email/SMS delivery were originally listed here as out of scope, with FR-21 specifying a *simulated* payment. Introducing the hold-then-pay flow (ADR-009) moved both into scope; see the revision history and ADR-009 to ADR-012. This is recorded as a deliberate, documented evolution of the baseline, not scope drift.

### A4.3 Assumptions and constraints

- **Technology constraint (from brief):** frontend is React; backend is Node.js only; database is MongoDB; no other server/language is permitted. No optional Python/Java service is used. The brief explicitly permits either classic JavaScript or TypeScript; Encore uses **TypeScript on the client and JavaScript on the server** (ADR-008).
- **Effort constraint:** solo developer, 80+ hours.
- **Availability constraint:** limited staff support over summer; the plan front-loads risk.
- **Assumption:** peak concurrency is modest (see §A7 load estimation) — a single API instance is sufficient.
- **Assumption:** the MongoDB Atlas free/shared tier provides sufficient storage and connection capacity for the estimated load (§A7); its connection limit is well above the single API instance's pool size.
- **Constraint:** the data tier requires outbound network access from the API container and from CI runners; Atlas IP access rules must permit both.
- **Assumption:** seat layouts are fixed per venue and do not change after an event is published.
- **AI-use constraint:** generative AI used only in the permitted assistive roles (idea generation, structuring, architecture outlining, research, language refinement, code review, debugging support, test-case suggestions); all submitted code is written and understood by the developer.

## A5. Stakeholders and users

| Stakeholder | Interest / role |
|---|---|
| Fan (customer) | Primary end user; books tickets |
| Administrator | Manages events, venues, bookings |
| Module leader / assessor | Evaluates against the rubric |
| Developer (you) | Designs, builds, tests, documents |

**Target user types** (expanded in SRS §C3): unauthenticated visitor, registered customer, administrator.

## A6. System architecture

### A6.1 Architectural style

Encore uses a **modular monolith** on the server (a single deployable Node.js process with internally separated layers) behind a React single-page client, with MongoDB as the datastore and a Socket.IO channel for realtime updates. The rationale, and the microservices alternative considered, are recorded in **ADR-001**.

### A6.2 Component diagram

```
                        ┌─────────────────────────────┐
                        │        Browser (client)     │
                        │  ┌───────────────────────┐  │
                        │  │  React SPA            │  │
                        │  │  · Event browse       │  │
                        │  │  · Seat map           │  │
                        │  │  · Checkout           │  │
                        │  │  · Admin dashboard    │  │
                        │  └───────┬───────┬───────┘  │
                        └──────────│───────│──────────┘
                            HTTPS  │       │  WebSocket
                          (REST)   │       │  (Socket.IO)
        ┌──────────────────────────▼───────▼──────────────────────────┐
        │              Node.js / Express API container                │
        │                                                             │
        │   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   │
        │   │  Routes      │──▶│ Controllers  │──▶│  Services     │   │
        │   │ (HTTP edge)  │   │ (req/res)    │   │ (domain logic)│   │
        │   └──────────────┘   └──────────────┘   └───────┬───────┘   │
        │   ┌──────────────┐   ┌──────────────┐           │           │
        │   │ Auth m/ware  │   │ Socket gateway├──────────┤           │
        │   │ (JWT verify) │   │ (broadcast)  │           │           │
        │   └──────────────┘   └──────────────┘           ▼           │
        │                                        ┌───────────────┐    │
        │                                        │ Models        │    │
        │                                        │ (Mongoose)    │    │
        │                                        └───────┬───────┘    │
        └────────────────────────────────────────────────│────────────┘
                                                         │ TCP
                                    ═════════════│═════════════ network
                                                 │  TLS + SRV connection string
                                                 │  (injected via env var)
                                          ┌──────▼──────────────────────┐
                                          │  MongoDB Atlas (managed)    │
                                          │  replica set, external host │
                                          │  users · venues             │
                                          │  events · bookings          │
                                          └─────────────────────────────┘
```

**External service dependencies (v2.3 amendment, ADR-009 to ADR-012):** the Services layer also reaches three third-party HTTPS endpoints, each outbound-only and each explicitly best-effort — a failure in any of them degrades gracefully rather than failing the triggering request (notifications, ADR-012) or is resolved asynchronously by the reaper/webhook rather than the request thread (Stripe):

```
        ┌────────────────────────────────────────────────────────────┐
        │         Node.js / Express API container (Services)          │
        └───────────────────────────┬───────────────────────────────┘
                                     │ HTTPS (outbound; Stripe also calls
                                     │ back in via the signed webhook)
                    ┌────────────────┼─────────────────┐
                    │                │                  │
             ┌──────▼───────┐ ┌──────▼───────┐  ┌───────▼───────┐
             │    Stripe    │ │ SMTP provider │  │   notify.lk   │
             │  (Checkout   │ │ (nodemailer;  │  │  (SMS REST    │
             │  Sessions +  │ │  Ethereal in  │  │  API, called  │
             │  signed      │ │  dev if       │  │  via global   │
             │  webhooks)   │ │  unconfigured)│  │  `fetch`)     │
             └──────────────┘ └───────────────┘  └───────────────┘
```

**Deployment topology:** two locally orchestrated containers (client, API) via `docker-compose`, plus a managed MongoDB Atlas replica set hosted externally. The system therefore runs across three independently hosted tiers on separate machines — comfortably satisfying the brief's requirement that the system be distributed and capable of running on multiple computers. Atlas is itself a multi-node replica set, so the data tier is distributed in its own right.

The connection string is **never** hard-coded or committed; it is supplied to the API container through the `MONGODB_URI` environment variable (see §A6.4).

### A6.3 Layer responsibilities

| Layer | Technology | Responsibility |
|---|---|---|
| Client | React + **TypeScript**, CSS | UI, seat map rendering, WebSocket subscription, optimistic UI; compile-time type safety over view state |
| Routes | Express Router (**JavaScript**) | HTTP edge; URL → controller mapping only |
| Middleware | Express | JWT verification, role checks, validation, error handling |
| Controllers | Express handlers | Parse request, call service, shape response |
| Services | Plain JS modules | Domain logic (seat allocation, pricing, booking rules) |
| Socket gateway | Socket.IO | Room management, broadcast of seat-state changes |
| Models | Mongoose | Schema, validation, indexes, atomic operations |
| Data | MongoDB | Persistence |

Controllers contain no domain logic and services contain no HTTP concepts — this separation is the concrete **single-responsibility** and **dependency-inversion** evidence cited in the report's Design section.

### A6.4 Configuration and secrets handling

The Atlas connection string embeds a database username and password, making it a credential rather than a configuration value. It is handled accordingly:

| Environment | Source of `MONGODB_URI` | Notes |
|---|---|---|
| Local development | `.env` file, listed in `.gitignore` | Never committed |
| Docker | `env_file` / `environment` in `docker-compose.yml`, values from the host | Compose file itself contains no secret |
| CI (GitHub Actions) | Repository secret `MONGODB_URI` | Referenced as `${{ secrets.MONGODB_URI }}` |
| Repository | `.env.example` with placeholder values only | Documents required variables without exposing them |

**Controls:**

- `.gitignore` contains `.env` before the first commit that creates one.
- A separate Atlas database user is used for the test environment, with access scoped to the test database only.
- Atlas network access is restricted to known IPs where practical; where CI requires it, the allowance is scoped and documented rather than left permanently open.
- The submitted repository is checked for accidentally committed credentials before final submission.

This matters beyond good practice: the repository link is submitted for marking and a leaked live credential in git history is both a security failure and an avoidable professionalism mark.

### A6.5 Data flow — the critical path (booking a seat)

```
1.  Client        GET /api/events/:id            → event + seat states
2.  Client        socket.emit('join:event', id)  → joins room `event:<id>`
3.  User selects seats (client-side state only, no server call)
4.  Client        POST /api/bookings {eventId, seats[]}  + JWT
5.  Middleware    verify JWT → attach req.user
6.  Service       atomic conditional update:
                  updateOne({_id, 'seats.id': {$in: sel}, 'seats.$[].status':'available'},
                            {$set: status:'booked'})
7a. If matchedCount = 0  → 409 Conflict "Seat no longer available"
7b. If matchedCount = 1  → create Booking doc
8.  Gateway       io.to(`event:<id>`).emit('seats:updated', {seatIds, status})
9.  All clients   reducer updates seat map → seat turns ash
10. Booking client receives 201 + confirmation payload
```

Step 6 is the concurrency control point and is the reason no double-booking can occur — see **ADR-004**.

**Amendment note (v2.3, ADR-009):** step 6 now targets `held` rather than `booked` — the matcher and update mechanism are otherwise unchanged. Step 10 returns `{booking, clientSecret}` with the booking `pending`, not a final confirmation: a Stripe Checkout Session is opened after step 7b, and the client pays against `clientSecret` via the embedded Payment Element. The booking only reaches `confirmed` (seats `held → booked`) when the Stripe webhook in §C7.1 is received and verified — never as a direct result of this request. See ADR-009 to ADR-011 for the full sequence.

## A7. Load estimation and scale

Sizing is deliberately modest and stated so the design can be judged against it.

| Metric | Estimate | Basis |
|---|---|---|
| Registered users | ~1,000 | Coursework-scale demonstration |
| Concurrent viewers per popular event | 50–100 | On-sale spike assumption |
| Peak API requests | ~20 req/s | 100 users × ~0.2 req/s browsing |
| Peak WebSocket connections | ~200 | All viewers across all live events |
| Bookings per day | ~500 | Well within single-instance capacity |
| Data volume (1 year) | < 500 MB | Bookings dominate; small documents |

**Conclusion:** a single API instance and a single MongoDB instance are comfortably sufficient. Vertical headroom is large; horizontal scaling is explicitly deferred (§A4.2) and the migration path is recorded in ADR-001 and ADR-003 consequences.

## A8. Deliverables

| ID | Deliverable | Description |
|---|---|---|
| D1 | Report (PDF, ≤2,000 words) | Requirements, design, testing, DevOps, evaluation; GitHub + YouTube links on page 1 |
| D2 | Source code | GitHub Classroom repo, excluding `node_modules` |
| D3 | Video (≤5 min, narrated) | Demo of functionality + tests + pipeline running |
| — | This PID/SRS/ADR set | Planning baseline (appendix material for D1) |

## A9. Project plan and milestones

Iterative delivery across six sprints. Each sprint ends with working, committed, tested increments.

| Sprint | Focus | Key outputs | Exit criteria |
|---|---|---|---|
| S0 — Setup | Repo, tooling, CI skeleton, Atlas cluster, secrets, design tokens | GitHub repo, ESLint + Jest configured, `.env` ignored, Atlas cluster reachable | Empty pipeline green on `main`; API connects to Atlas; no secrets in git |
| S1 — Data + Auth | Models, registration, login, JWT | User/Event/Venue/Booking schemas; auth endpoints | FR-1–4 pass unit + integration tests |
| S2 — Core API + CRUD | REST endpoints for all entities | CRUD for 4 entities | All CRUD integration tests green |
| S3 — Realtime + concurrency | Socket.IO seat state; atomic booking | Live availability; concurrency guard | O7 met (zero double-bookings under load) |
| S4 — Client + Admin | Full UI, seat map, admin dashboard, containers | `docker-compose` stack running | Full booking flow works end-to-end |
| S5 — Test + UAT | Usability round, coverage push, static analysis | UAT results + modifications | O5 met (≥70% coverage) |
| S6 — Hardening + Docs | Bug-fix, report, video | Report, video, tagged release | Submission-ready |

**Milestones:** M1 auth (end S1) · M2 CRUD (end S2) · M3 realtime + integrity (end S3) · M4 distributed stack (end S4) · M5 verified quality (end S5) · M6 submission (end S6).

## A10. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | WebSocket sync complexity underestimated | Med | High | Build realtime early (S3); spike a minimal broadcast first | Dev |
| R2 | Scope creep from ambitious feature set | High | Med | MoSCoW prioritisation (§C4); "could" features cut first | Dev |
| R3 | Limited staff support over summer | High | Med | Front-load risky work; stay on well-supported stack | Dev |
| R4 | Seat-state race conditions (double-booking) | Med | High | Atomic conditional update (ADR-004); concurrency test in CI | Dev |
| R5 | CI/CD misconfiguration | Med | Low | Establish pipeline in S0 before features exist | Dev |
| R6 | Time overrun as solo developer | Med | High | Timeboxed sprints; cut "could-have" features to protect core | Dev |
| R7 | Socket state lost on server restart, clients stale | Low | Med | Clients re-fetch seat state on reconnect (§C7.3) | Dev |
| R8 | Insufficient UAT participants recruited | Med | Med | Recruit early in S4; target 5, minimum 3 | Dev |
| R9 | **Atlas connection string committed to the public repo** | Med | **High** | `.env` git-ignored from the first commit; `.env.example` with placeholders only; credential scan before submission; rotate immediately if exposed | Dev |
| R10 | Atlas IP allowlist blocks CI runners, failing the pipeline | Med | Med | Configure Atlas network access for CI early in S0; verify pipeline connects before feature work | Dev |
| R11 | Network dependency — demo or marking fails without internet | Low | High | Verify connectivity before recording the video; keep a local MongoDB fallback profile in compose | Dev |
| R12 | Shared-tier Atlas throttling under the concurrency test | Low | Med | Run the 50-request concurrency test against an ephemeral local instance to avoid tier limits | Dev |

## A11. Monitoring and observability

Proportionate to scale, but present — absence of any operational thinking is a common weakness in student projects.

- **Structured logging:** JSON logs with request id, user id, route, status, and duration.
- **Health endpoint:** `GET /api/health` reports API status and MongoDB connectivity; used as the Docker healthcheck.
- **Error tracking:** all unhandled errors funnel through a single Express error middleware that logs with stack and returns a safe client message.
- **Key signals to watch:** 5xx rate, booking-conflict (409) rate, WebSocket connection count, p95 booking latency, hold-reaper sweep count (a sustained non-zero count indicates checkout abandonment or a struggling payment step, per ADR-009's named risk).
- **Atlas-side observability:** the provider dashboard supplies connection counts, slow-query logs, and storage usage at no implementation cost — used to verify the §C6.3 indexes are actually being hit.
- **Third-party dependency observability (v2.3 amendment):** the Stripe Dashboard's Events log and the notify.lk account balance/delivery log supplement application logs for the three external dependencies added by ADR-009/ADR-012; notification failures are logged via `pino` but, by design (ADR-012), never raise an alert-worthy application error.

## A12. Ethics, security, and academic integrity

- **Ethics:** usability testing follows University ethical guidelines — participant consent, right to withdraw, anonymised results.
- **Security:** passwords hashed with bcrypt (cost 10+); JWT for session auth with expiry; role-based authorisation enforced server-side; input validation on all endpoints (NFR-4); rate limiting on auth and booking routes; no sensitive data in query strings.
- **Payment card data (v2.3 amendment, NFR-3):** card details are entered directly into Stripe's embedded Payment Element, which tokenises them client-side inside Stripe's iframe. Card data never transits the Encore server, is never logged, and is never stored — the server only ever sees a Stripe session id, payment intent id, and status. This keeps the server's PCI DSS scope to the minimal SAQ A category, since it never touches, stores, or transmits cardholder data.
- **Academic integrity:** all work is the developer's own; sources referenced; generative AI used only within the brief's permitted assistive categories.

---
# Part B — Architecture Decision Records

Twelve decisions material enough to warrant a record — the original eight (ADR-001 to ADR-008), plus four added in the v2.3 amendment (ADR-009 to ADR-012) when real payment and notifications came into scope. Each states the forces at play, the options genuinely considered, the trade-offs, and what the decision makes harder — not just what it makes easier.

---

## ADR-001: Modular monolith over microservices

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
The brief permits multiple optional backend servers. The system has three broad concerns — accounts, catalogue (events/venues), and booking/realtime. A solo developer has 80+ hours and limited staff support. The report must describe whether the architecture is monolithic or micro-service based, so the choice must be deliberate and defensible either way.

### Decision
Build a **single Node.js/Express service with strict internal module boundaries** (routes → controllers → services → models), deployed as one container alongside the client and database containers.

### Options considered

**Option A — Modular monolith (chosen)**

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Time to market | Fast |
| Scalability | Adequate for estimated load (§A7) |
| Team familiarity | High |
| Operational burden | Low — one service to run and debug |

**Pros:** one codebase, one deploy, no network calls between concerns, transactional simplicity, far less YAML and infrastructure work; a solo developer can hold the whole system in their head.
**Cons:** all concerns scale together; a fault in one module can affect the process; module boundaries are enforced by discipline rather than by the network.

**Option B — Microservices (auth service + catalogue service + booking service)**

| Dimension | Assessment |
|---|---|
| Complexity | High |
| Time to market | Slow |
| Scalability | Better in principle, unnecessary at this load |
| Team familiarity | Moderate |
| Operational burden | High — 3+ services, inter-service auth, distributed debugging |

**Pros:** independent scaling and deployment; hard boundaries; demonstrates distributed-systems breadth.
**Cons:** distributed transactions across booking and catalogue become genuinely hard; the seat-booking atomicity guarantee (ADR-004) would need a saga or distributed lock; debugging spans processes; the effort would come directly out of the testing and realtime budget, which carry more marks.

### Trade-off analysis
The decisive factor is that the estimated peak load (§A7) is roughly 20 req/s — three orders of magnitude below where service decomposition pays for itself. Microservices would buy scalability the system does not need, at the direct cost of the booking-integrity guarantee (O7) and test coverage (O5), which are both explicitly assessed. Choosing the monolith is therefore not the easy option but the correct one for the constraints; the internal layering preserves the option to extract a service later.

### Consequences
- **Easier:** atomic booking logic, local debugging, one CI pipeline, one deployment.
- **Harder:** modules must be kept separate by convention; a lint rule and code review substitute for network boundaries.
- **Revisit when:** sustained load exceeds ~200 req/s, or the booking module's release cadence needs to diverge from the catalogue's.

### Action items
1. [ ] Enforce `routes → controllers → services → models` import direction.
2. [ ] Keep the socket gateway behind a service interface so it can be extracted later.

---

## ADR-002: MongoDB with an embedded seat array

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
The brief permits MongoDB or PouchDB only. Within MongoDB, seat state can be modelled either as an array embedded in the Event document or as a separate `seats` collection. This choice determines how seat availability is read and how booking concurrency is controlled.

### Decision
Use **MongoDB**, with seats **embedded as an array inside the Event document**, and bookings in a separate referencing collection.

### Options considered

**Option A — Embedded seat array on Event (chosen)**

| Dimension | Assessment |
|---|---|
| Read performance | Excellent — one query renders the whole seat map |
| Write atomicity | Excellent — single-document updates are atomic in MongoDB |
| Complexity | Low |
| Document size risk | Acceptable — 500 seats ≈ 40 KB, far below the 16 MB limit |

**Pros:** the entire seat map arrives in one round trip; MongoDB guarantees single-document atomicity, which gives concurrency safety for free (ADR-004); no joins.
**Cons:** very large venues (>10,000 seats) would bloat the document; seat-level queries across events are awkward.

**Option B — Separate `seats` collection**

**Pros:** unbounded venue size; seats queryable independently.
**Cons:** rendering a seat map needs a second query or `$lookup`; booking multiple seats atomically now spans multiple documents, requiring a multi-document transaction — significantly more complex and slower.

**Option C — PouchDB**

**Pros:** offline-first sync is interesting.
**Cons:** its sync model conflicts with the requirement that the server be the single authority on seat state; last-write-wins conflict resolution is precisely wrong for ticket booking, where a conflict must reject one party rather than silently merge.

### Trade-off analysis
Option A trades unbounded venue size — which the assumptions in §A4.3 make irrelevant — for atomicity that is otherwise expensive to obtain. PouchDB is rejected on correctness grounds, not convenience: an eventually-consistent store cannot uphold the no-double-booking requirement (O7).

### Consequences
- **Easier:** seat map reads, booking atomicity, schema comprehension.
- **Harder:** supporting stadium-scale venues; per-seat analytics across events.
- **Revisit when:** a venue exceeds ~5,000 seats, or seat-level cross-event reporting is required.

### Action items
1. [ ] Cap seeded venue size at 500 seats.
2. [ ] Index `events.date` and `bookings.userRef` (see §C6.3).

---

## ADR-003: Socket.IO over raw WebSockets

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
The brief mandates WebSockets to give the appearance of communication between multiple clients. The system needs per-event broadcast (only clients viewing event X should receive X's seat updates), and must behave sanely when a client's connection drops.

### Decision
Use **Socket.IO**, with one room per event (`event:<id>`).

### Options considered

**Option A — Socket.IO (chosen)**

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Features needed | Rooms, auto-reconnect, heartbeat — all built in |
| Team familiarity | High |
| Overhead | Slightly larger payload than raw `ws` |

**Pros:** rooms give per-event targeting without hand-rolled subscription bookkeeping; automatic reconnection with backoff directly mitigates R7; mature client library; broad documentation and staff familiarity.
**Cons:** a protocol layer on top of WebSocket, so slightly heavier frames and a dependency on matching client/server versions.

**Option B — Raw `ws` library**

**Pros:** minimal, no abstraction, smallest frames.
**Cons:** rooms, reconnection, and heartbeats must all be written by hand — roughly the same code Socket.IO already provides, but untested and consuming hours budgeted for testing.

### Trade-off analysis
The only genuine advantage of raw `ws` is payload size, which is immaterial at 200 concurrent connections. The reconnection and room logic that would have to be reimplemented is exactly the kind of infrastructure code that generates bugs and consumes the testing budget. Socket.IO is the disciplined choice, not the lazy one.

### Consequences
- **Easier:** per-event targeting, reconnection resilience, client integration.
- **Harder:** scaling beyond one server instance later requires the Redis adapter for cross-instance broadcast (explicitly out of scope, §A4.2).
- **Revisit when:** a second API instance is introduced.

### Action items
1. [ ] Namespace rooms as `event:<id>`.
2. [ ] On client reconnect, re-fetch authoritative seat state rather than trusting cached state.

---

## ADR-004: Atomic conditional update for seat concurrency

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
Two users may attempt to book the same seat within milliseconds. Requirement O7 and FR-15 demand that exactly one succeeds. This is the single most important correctness property in the system.

### Decision
Perform booking as a **single atomic conditional update** on the Event document: match the event *and* the requirement that all requested seats are still `available`, and set them to `booked` in one operation. If `matchedCount` is 0, the seats were taken in the interim and the request returns `409 Conflict`.

### Options considered

**Option A — Atomic conditional update (chosen)**

**Pros:** relies on MongoDB's guaranteed single-document atomicity; no locks to acquire or release; no deadlocks; no cleanup required if a client disappears mid-checkout; correct by construction.
**Cons:** the losing user learns of the conflict only at submission, not at selection time.

**Option B — Read-then-write (check availability, then update)**

**Pros:** simple to write.
**Cons:** a textbook time-of-check-to-time-of-use race. Two requests can both read "available" before either writes. **Rejected as incorrect.**

**Option C — Pessimistic seat hold with TTL lock**

**Pros:** the losing user is told immediately at selection time; better UX during a high-demand on-sale.
**Cons:** requires a lock store, TTL expiry handling, and cleanup for abandoned checkouts; introduces the possibility of seats stranded in a held state after a crash; substantially more code and more failure modes.

### Trade-off analysis
Option B is not a real option — it is the bug this ADR exists to prevent, recorded here so the report can show the race was reasoned about rather than stumbled into. Option C offers genuinely better UX and is what a commercial ticketing platform would do at scale, but it buys that UX with a stateful lock lifecycle that is a meaningful source of defects. Given a solo developer and a hard correctness requirement, Option A is chosen: correctness first, with a `seats:updated` broadcast (ADR-003) narrowing the conflict window in practice, since most clients see a seat disappear before they try to book it.

### Consequences
- **Easier:** provable correctness; no lock lifecycle; trivially testable with concurrent requests.
- **Harder:** a small residual window where a user selects a seat and is rejected at checkout; the client must handle 409 gracefully with a clear message and a refreshed map.
- **Revisit when:** on-sale contention becomes high enough that 409s are common — then move to Option C.

### Action items
1. [ ] Implement the conditional update in `bookingService`.
2. [ ] Write a concurrency test firing 50 simultaneous bookings at one seat; assert exactly one 201 and 49 409s.
3. [ ] Client handles 409 with "That seat was just taken" and re-renders from server state.

---

## ADR-005: JWT over server-side sessions

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
The brief requires security considerations including registration and login. The API is consumed by a separate React origin and must authenticate both REST requests and the WebSocket handshake.

### Decision
Use **stateless JWTs** with a short expiry, sent as a `Bearer` token and verified by Express middleware and at the Socket.IO handshake.

### Options considered

**Option A — JWT (chosen)**

**Pros:** stateless, so no session store to run; works cleanly across the client's separate origin; the same token authenticates both HTTP and the socket handshake; the FAQ explicitly permits JWTs.
**Cons:** tokens cannot be revoked before expiry; payload is readable (signed, not encrypted); requires care over storage on the client.

**Option B — Server-side sessions with a cookie**

**Pros:** instant revocation; opaque identifier reveals nothing.
**Cons:** requires a session store (a second stateful dependency); cross-origin cookie configuration adds friction; authenticating the socket handshake is more awkward.

### Trade-off analysis
Revocation is the one real advantage of sessions, and it matters most for long-lived privileged sessions. It is mitigated here with short token lifetimes. Against that, sessions would add a stateful store to a system whose statelessness is a design asset. JWT is chosen with the revocation weakness acknowledged rather than glossed over.

### Consequences
- **Easier:** stateless API, uniform auth for HTTP and WebSocket, simple horizontal scaling later.
- **Harder:** immediate logout-everywhere; token storage must avoid XSS exposure.
- **Revisit when:** admin privilege escalation or forced logout becomes a requirement — then add a short-lived access token plus a revocable refresh token.

### Action items
1. [ ] Set a short access-token expiry.
2. [ ] Verify the token in the Socket.IO handshake, not only on REST routes.
3. [ ] Never place the token in a URL query string (NFR-3).

---

## ADR-006: No caching layer

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
Event listings are read-heavy and would be an obvious caching candidate. A Redis cache is a common instinct at this point in a design.

### Decision
**Introduce no caching layer.** Serve all reads directly from MongoDB, relying on indexes (§C6.3).

### Options considered

**Option A — No cache (chosen)**

**Pros:** no staleness risk on seat state — the correctness property the whole system rests on; no extra container; no invalidation logic; MongoDB at 20 req/s with proper indexes is nowhere near strained.
**Cons:** forgoes read-latency headroom the system does not currently need.

**Option B — Redis cache for event listings**

**Pros:** faster listing reads; useful practice with cache-aside.
**Cons:** introduces a fourth container and an invalidation problem; the tempting extension — caching seat state — would directly undermine ADR-004 by serving stale availability.

### Trade-off analysis
Caching here would be optimisation without a measured problem, and the failure mode it invites (stale seat availability) attacks the system's core guarantee. Deliberately declining a component is itself an architectural decision worth recording, and demonstrates restraint rather than an absence of consideration.

### Consequences
- **Easier:** correctness, simpler deployment, fewer moving parts to test.
- **Harder:** if read load grows unexpectedly, headroom must be found through indexing or scaling first.
- **Revisit when:** p95 read latency exceeds 200 ms or MongoDB CPU is sustained above 70%.

### Action items
1. [ ] Add the indexes in §C6.3 and confirm listing queries use them.

---

## ADR-007: MongoDB Atlas (managed) over a self-hosted MongoDB container

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
ADR-002 settled MongoDB as the datastore and the embedded-seat-array schema. A separate question remains: where does MongoDB actually run? The options are a self-hosted `mongo` container in `docker-compose`, or a managed MongoDB Atlas cluster reached over the network via a connection string. The brief requires the system to be distributed and capable of running on multiple computers, so the choice must not undermine that.

### Decision
Use a **managed MongoDB Atlas cluster**, with the connection string injected into the API container as the `MONGODB_URI` environment variable. Automated tests run against an ephemeral `mongodb-memory-server` rather than Atlas.

### Options considered

**Option A — MongoDB Atlas managed cluster (chosen)**

| Dimension | Assessment |
|---|---|
| Setup effort | Low — cluster provisioned once, no container tuning |
| Operational burden | Low — backups, patching, monitoring handled by the provider |
| Distribution | Strong — data tier genuinely runs on separate hosts as a replica set |
| Cost | Free/shared tier sufficient at this scale |
| Risk | Introduces a network dependency and a live credential to protect |

**Pros:** no database container to configure or debug; the cluster is a real replica set, so the data tier is distributed in its own right and demonstrably runs on different machines from the API; data survives local container teardown, which matters for UAT sessions and the demonstration video; provider dashboards give free observability.
**Cons:** the system now depends on internet connectivity to run at all; the connection string is a credential that must never reach the repository; shared-tier resource limits are real; CI runners must be permitted through Atlas network access rules.

**Option B — Self-hosted `mongo` container in docker-compose**

| Dimension | Assessment |
|---|---|
| Setup effort | Low–medium |
| Operational burden | Medium — persistence volumes, no backups by default |
| Distribution | Adequate — a separate container, but typically the same host |
| Cost | Free |
| Risk | Data loss on volume removal; single node, no replication |

**Pros:** fully self-contained, works offline, no credential leaves the machine, no third-party dependency, trivially reproducible for a marker running `docker-compose up`.
**Cons:** single-node with no replication; data lost if the volume is pruned; the developer carries all operational concerns; in practice all three containers usually run on one physical host, which is a weaker demonstration of distribution.

### Trade-off analysis
The two genuine costs of Atlas are the network dependency and the credential-handling burden. The network dependency is a real regression in reproducibility — a marker cannot run the stack without the environment variable, which is why `.env.example` and clear README instructions become mandatory rather than optional. The credential burden is a genuine risk (R9) and the most common way this decision goes wrong in student projects: a connection string with an embedded password committed to a repository that is then submitted for marking.

Against that, Atlas removes an entire class of operational work (volumes, persistence, backup) from an 80-hour solo budget, and provides a stronger answer to the "distributed across multiple computers" requirement, since the replica set demonstrably runs on hosts separate from the application. The decisive mitigation is that tests do not depend on Atlas at all — using `mongodb-memory-server` keeps CI fast, offline-capable, and immune to tier limits, so the network dependency is confined to development and demonstration rather than infecting the pipeline.

### Consequences
- **Easier:** no database container to operate; durable data across teardowns; replica-set distribution for free; provider-side monitoring.
- **Harder:** the stack no longer runs offline; every environment needs configuration to start; a live credential must be kept out of git history for the entire life of the repository; Atlas network rules must accommodate CI.
- **Revisit when:** shared-tier limits are hit under load, or offline reproducibility becomes a requirement for marking — a local `mongo` container profile in `docker-compose` is kept as a documented fallback (R11).

### Action items
1. [ ] Add `.env` to `.gitignore` **before** the first commit that creates it.
2. [ ] Commit `.env.example` with placeholder values documenting every required variable.
3. [ ] Store `MONGODB_URI` and `JWT_SECRET` as GitHub Actions repository secrets.
4. [ ] Create separate Atlas databases for development and demonstration, with scoped users.
5. [ ] Configure Atlas network access for CI runners in S0, before feature work.
6. [ ] Install and wire `mongodb-memory-server` for the test suite.
7. [ ] Scan git history for committed credentials before submission; rotate the Atlas password if any exposure is found.
8. [ ] Document the setup steps in the repository README so the stack is reproducible by a marker.

---

## ADR-008: TypeScript on the client, JavaScript on the server

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
The brief permits either classic JavaScript or TypeScript, and does not require both sides to match. The client carries substantial stateful complexity — seat selection state, WebSocket event payloads, API response shapes, role-conditional rendering — where type errors are easy to introduce and awkward to catch at runtime. The server is comparatively thin: routes, controllers, services, and Mongoose models, where Mongoose already enforces schema at the data boundary and where adding a build step costs setup time from an 80-hour budget.

### Decision
Write the **client in TypeScript** under `strict` mode, and the **server in JavaScript** (ES modules) with JSDoc type annotations on service-layer functions.

### Options considered

**Option A — TypeScript client, JavaScript server (chosen)**

| Dimension | Assessment |
|---|---|
| Setup effort | Low — CRA/Vite ships TS support; server needs no build step |
| Safety where it matters | High — types applied to the most error-prone layer |
| Server iteration speed | Fast — no compile step, direct `node` execution |
| Cost | The API boundary loses compile-time verification |

**Pros:** type safety concentrated where state complexity actually lives; the server runs directly under Node with no transpilation, keeping the container simple and stack traces honest; Mongoose schemas already validate the data boundary, so server-side static typing is partly redundant; less build configuration to debug during a summer with limited staff support.
**Cons:** types stop at the network boundary — the client's declared response types are an *assumption* about the server, not a guarantee checked by a compiler; the two halves use different tooling configurations.

**Option B — TypeScript on both sides**

**Pros:** end-to-end type safety; response types could be defined once in a shared package and imported by both, making the API contract compiler-enforced.
**Cons:** requires a server build step, `ts-node` or compiled output in the Docker image, type definitions for Express/Mongoose/Socket.IO, and a shared-package or monorepo setup to actually realise the shared-types benefit. Without that shared package the end-to-end safety is illusory anyway — two independently declared type sets that merely look alike. The setup cost lands squarely in S0–S1, competing with the realtime and testing work that carries more marks.

**Option C — JavaScript on both sides**

**Pros:** simplest possible toolchain, fastest to start, one mental model.
**Cons:** forgoes type safety exactly where the client's seat-state and payload handling would benefit most; refactoring the seat map late in the project becomes riskier.

### Trade-off analysis
The real question is where type safety earns its setup cost. On the client it clearly does: seat state, socket payloads, and role-conditional rendering are where silent shape errors hide. On the server, Mongoose schemas plus integration tests already cover most of what server-side types would catch, so TypeScript there buys less per hour spent.

The honest cost of this split is the **API boundary seam**: the client declares what it expects a response to look like, and nothing verifies that the server agrees. Option B could close that seam — but only with a genuine shared-types package, which is real monorepo work. Rather than pretend the seam does not exist, it is closed deliberately by testing: every endpoint in §C7.1 has an integration test asserting its response shape, so the contract is verified at runtime in CI even though it is not verified at compile time. That is a weaker guarantee than a shared type, and is recorded as such.

### Consequences
- **Easier:** confident client refactoring; no server build step; simpler API container; fast server iteration.
- **Harder:** the API contract must be maintained by discipline and integration tests rather than by the compiler; client response types must be updated by hand whenever an endpoint changes; two tooling configurations to keep lint-clean.
- **Revisit when:** the API surface grows large enough that hand-maintained client types drift from reality — the migration path is to extract shared type definitions into a workspace package and adopt TypeScript server-side incrementally, which JSDoc annotations make cheaper.

### Action items
1. [ ] Enable `strict` in the client `tsconfig.json`; ban `any` on API response types via lint rule.
2. [ ] Define all API response and socket payload types in a single client-side `types/api.ts` so drift has one place to be fixed.
3. [ ] Add `tsc --noEmit` as a CI step (NFR-9a).
4. [ ] Assert response shape in the integration test for every endpoint in §C7.1 (NFR-9b).
5. [ ] Add JSDoc type annotations to server service-layer functions to preserve editor support and ease any future migration.
6. [ ] Configure ESLint separately for each side (`@typescript-eslint` on the client, base config on the server).

---

## ADR-009: Hold-then-pay supersedes ADR-004's Option A choice

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole) · **Amends:** ADR-004 (v2.3)

### Context
ADR-004 chose Option A — an atomic conditional update straight from `available` to `booked` at submission time — over Option C, a pessimistic seat hold with a TTL, explicitly naming its cost: "the losing user learns of the conflict only at submission, not at selection time," and recording as its own trigger: **"Revisit when: on-sale contention becomes high enough that 409s are common — then move to Option C."**

Introducing real payment (v2.3) forces this revisit regardless of measured contention, for a reason ADR-004 did not anticipate: a booking can no longer be "confirmed" the instant seats are claimed, because a real payment has to be collected first, and that takes the user tens of seconds to minutes to complete. Booking straight to `booked` at submission time — as ADR-004 did — would mean charging nothing and calling a seat sold before any money has moved, which is simply wrong once payment is real. Some intermediate state between "seats claimed" and "payment captured" is now unavoidable; that intermediate state is exactly Option C's hold.

### Decision
Adopt **Option C — pessimistic seat hold with a TTL** for the interval between seat selection and payment. Seats move `available → held` (not `available → booked`) in the same atomic conditional update ADR-004 built; the booking is created `pending` with `holdExpiresAt = now + HOLD_TTL_MINUTES`; a background reaper releases any hold whose TTL lapses unpaid; a Stripe webhook (ADR-011) is the sole path from `pending`/`held` to `confirmed`/`booked`.

### Options considered

**Option A — Extend ADR-004's Option A: mark `booked` at submission, refund if payment fails**

**Pros:** no new hold lifecycle, no reaper.
**Cons:** a seat reads as sold to every other viewer while the payer may still abandon or fail to pay; "booked" would stop meaning what the rest of the system assumes it means; a failed payment then needs its own seat-release path anyway, which is most of Option C's complexity acquired without any of its honesty benefit. Rejected.

**Option B — Keep Option A exactly, defer payment to a separate step with no hold**

**Pros:** simplest possible change.
**Cons:** two customers could both be told their submission "succeeded" and then compete for the same seat during payment, reintroducing exactly the race ADR-004 exists to prevent, one layer up. Rejected as incorrect for the same reason ADR-004 rejected read-then-write.

**Option C — Pessimistic seat hold with TTL (chosen)** — as scoped by ADR-004 at the time it was written.

### Trade-off analysis
ADR-004 was explicit that Option C's cost is a hold lifecycle: TTL expiry handling, cleanup for abandoned checkouts, and the possibility of seats stranded in a held state after a crash. All three costs are real and are paid here: the reaper (`server/src/jobs/holdReaper.js`) is a second background process that must not die silently, or its failure mode is seats stuck in `held` forever with no automatic recovery — this is now the system's single largest new operational surface, and is watched via the monitoring signal added in §A11. The added Stripe dependency (ADR-010) is a second new operational and credential-management burden.

Against that: **the atomic conditional seat-update mechanism itself is unchanged.** The `$all`/`$elemMatch`-guarded `updateOne` that ADR-004 built and the concurrency test (D4.3) exercises still runs exactly as before — it now targets `held` instead of `booked`, and nothing else about it moved. The concurrency guarantee this codebase is proudest of, and the one requirement (O7) that fails the whole project if it breaks, survives this change completely intact. What changed is only what the successful terminal state of that update is called, and what has to happen after it before a booking is final.

### Consequences
- **Easier:** the system now has an honest state for "seats claimed, payment in flight," which real payment requires; other viewers see a seat grey out the moment a checkout starts rather than only once it is paid, narrowing the residual 409 window ADR-004 accepted as a cost.
- **Harder:** a hold lifecycle now exists and must be correct — TTL computation, reaper cadence, and the guarded conditional updates that stop the reaper and the webhook from racing each other over the same booking (`findOneAndUpdate({_id, status: 'pending'}, ...)` on every transition). A dead reaper process is a new, silent failure mode with no user-facing symptom until support tickets arrive asking why a seat "shows available but won't book."
- **Revisit when:** the reaper's 60-second polling cadence proves too coarse for demo purposes (a shorter `HOLD_TTL_MINUTES` in a live demo could expire mid-narration), or a future move to a message-queue-driven expiry (rather than polling) is warranted by scale.

### Action items
1. [ ] Alert on the hold-reaper process being unreachable/not running (§A11).
2. [ ] Confirm every state transition off `pending` uses a guarded conditional update, never an unconditional `save()`.
3. [ ] Document `HOLD_TTL_MINUTES` and the "why is my booking stuck pending" failure mode in the README (missing `STRIPE_WEBHOOK_SECRET` in local dev is the most likely cause).

---

## ADR-010: Stripe Checkout Sessions with the embedded Payment Element

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
ADR-009 requires *some* mechanism to collect a real card payment against a `pending` booking's hold. Stripe offers several integration surfaces for this: hosted Checkout (a full-page redirect to a Stripe-branded payment page), raw Payment Intents with a hand-built card form, and Checkout Sessions created in `ui_mode: 'elements'` with the embedded Payment Element rendered inline.

### Decision
Use a **Stripe Checkout Session created with `ui_mode: 'elements'`**, rendering Stripe's **Payment Element** inline inside the existing checkout page, rather than redirecting to Stripe's hosted page.

### Options considered

**Option A — Hosted Checkout (full-page redirect)**

**Pros:** the least client code of any option — Stripe owns the entire payment page; PCI scope is trivially minimal.
**Cons:** the browser navigates away from `encore.live` to a Stripe-branded page and back, breaking the ticket-stub visual identity (Encore Design System v1.0) for the one screen that most needs to feel trustworthy and on-brand; the countdown-on-hold UX (FR-26) and the live seat-map "greyed out" feedback are awkward to preserve across a full navigation. Rejected on design-continuity grounds.

**Option B — Raw Payment Intents + a hand-built card form**

**Pros:** maximum control over every pixel of the payment UI.
**Cons:** substantially more client code for equivalent security and UX — manual `stripe.confirmCardPayment` wiring, manual error-state handling for every card decline code, and a hand-rolled card element instead of Stripe's maintained one. Stripe's own current guidance for exactly this shape of integration (single-page checkout, one product, no saved payment methods needed) is to use a Checkout Session with the embedded Payment Element, not raw Payment Intents. Rejected as more code for no material gain.

**Option C — Embedded Checkout Session with the Payment Element (chosen)**

**Pros:** the Payment Element renders inside the existing checkout page — no redirect, so the ticket-stub design and hold countdown stay on-screen throughout; Stripe maintains the card element, its validation, and its localisation; a single `clientSecret` from `POST /api/bookings` (or the re-issue endpoint) is all the client needs; card data is tokenised entirely inside Stripe's iframe, so it never reaches the Encore server (§A12, NFR-3).
**Cons:** slightly less visual control than a fully hand-built form (the Payment Element's internal layout is Stripe's, though its `appearance` object is themeable from the design tokens); ties the client to `@stripe/stripe-js` / `@stripe/react-stripe-js`.

### Trade-off analysis
Design continuity and reduced client code both point the same direction. Hosted Checkout is rejected specifically because this project is assessed partly on UI/UX polish, and a redirect away from the app for the single highest-stakes screen is a real regression. Raw Payment Intents is rejected because it reproduces work Stripe already provides, for a use case Stripe's own documentation says the embedded Payment Element is designed for.

### Consequences
- **Easier:** payment UI stays inside the Encore visual language; less client payment code to test and maintain; PCI scope stays at SAQ A.
- **Harder:** the client now depends on two Stripe packages and their `appearance` theming API rather than owning the form outright; local development requires a Stripe test-mode account and the Stripe CLI for webhook forwarding (README).
- **Revisit when:** a payment method requiring a genuine full-page redirect (e.g. certain bank-redirect methods) is added — Checkout Sessions support this without a rewrite, so no revisit is currently anticipated for the card-only scope in play here.

### Action items
1. [ ] Build `client/src/components/payments/StripeCheckoutForm.tsx` around `loadStripe` + the embedded Payment Element.
2. [ ] Theme the Element's `appearance` object from the design tokens in `client/src/index.css`, not Stripe's defaults.
3. [ ] Show a live hold countdown from `holdExpiresAt`, and route back to the event with a clear message when it reaches zero.

---

## ADR-011: Webhook-authoritative confirmation

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
Once a card payment completes in the browser, the client's Stripe integration receives a success callback. It is tempting to have that callback call the Encore API to mark the booking confirmed directly. This decision is about whether that client-reported success is ever trusted as the trigger for the authoritative `pending → confirmed` state change.

### Decision
**Never.** The client's post-payment success callback only navigates to the confirmation page and (optionally) shows an optimistic "confirming…" state. The **only** path that moves a booking `pending → confirmed` and its seats `held → booked` is a **Stripe webhook** — `checkout.session.completed`, with `payment_intent.succeeded` as a belt-and-braces second path — verified by signature and recorded in the `WebhookEvent` idempotency ledger before it is acted on.

### Options considered

**Option A — Trust the client's success callback (rejected)**

**Pros:** the confirmation page could update the instant the browser sees success, with no round trip to Stripe's asynchronous webhook delivery.
**Cons:** a client is not a trustworthy witness to its own payment. It can lie (a modified request from a browser's dev tools costs nothing to send), crash immediately after payment succeeds but before it reports success, lose the response to a network drop, or have its tab closed by the user mid-redirect. Any of these would either let an unconfirmed booking sit unclaimed forever, or — worse — let a forged "it succeeded" call confirm a booking nobody paid for. Rejected: it moves the system's single most security- and money-sensitive state transition onto the one party in the transaction with both the motive and the means to falsify it.

**Option B — Webhook-authoritative confirmation (chosen)**

**Pros:** Stripe's webhook is delivered by Stripe's own infrastructure, independently of anything the client does after payment; it is cryptographically signed with `STRIPE_WEBHOOK_SECRET`, so a forged delivery is detectable and rejected (400 `INVALID_SIGNATURE`); it fires even if the customer's browser crashes, closes, or loses connectivity immediately after paying, because Stripe retries delivery until it is acknowledged. This makes it the only source of truth the server can actually stand behind.
**Cons:** confirmation is not instantaneous from the client's point of view — there is a real, if usually sub-second, gap between "Stripe says payment succeeded" in the browser and the webhook landing at `/api/payments/webhook`. The confirmation page has to show an honest "confirming payment…" state for that gap (Phase 5 spec) rather than assuming success immediately.

### Trade-off analysis
This is not a close call. The client's report about its own payment is unauthenticated with respect to the server (it is just another API call it could make regardless of what actually happened at Stripe), whereas the webhook is a message from Stripe itself, signed with a secret the client never sees. Given that the transition being protected is "did this customer's card actually get charged," only the second is a valid basis for the decision. The small UX cost — a brief "confirming…" state — is worth paying to keep the server's most consequential state change tied to a source it can verify rather than one it can only hope is honest.

**Idempotency (the second half of this decision):** Stripe's delivery guarantee is *at-least-once*, not *exactly-once* — the same event can arrive twice (a retry after a slow 200, a manual resend from the Stripe dashboard, etc.). Processing `checkout.session.completed` twice must not double-apply the confirmation (e.g. re-sending the confirmation email, or worse, re-crediting something). The `WebhookEvent` collection is a unique-indexed ledger keyed on `stripeEventId`: the handler attempts an insert before doing anything else, and a duplicate-key error means "already processed" — the handler returns `200 {received: true}` immediately and does no further work. Every state transition inside the handler is additionally written as a guarded conditional update (`findOneAndUpdate({_id, status: 'pending'}, ...)`), so even if the ledger check were somehow bypassed, a booking that is no longer `pending` simply cannot be re-confirmed.

### Consequences
- **Easier:** the confirmation decision has exactly one code path and one trust boundary to audit; replay and out-of-order delivery are both verified non-issues by construction rather than by hoping Stripe never retries.
- **Harder:** the confirmation page must handle an asynchronous, unbounded-in-the-worst-case wait (mitigated by listening for `booking:updated` over the socket and polling every 2s for up to 30s as a fallback); local development requires `stripe listen --forward-to localhost:5000/api/payments/webhook` running, or webhooks never arrive and every booking appears stuck `pending` — a common source of "it looks broken" reports that is actually working as designed (documented in the README's troubleshooting note).
- **Revisit when:** never, for the payment-confirmation transition specifically — this is a correctness property, not a performance trade-off, and there is no load level at which trusting the client becomes acceptable.

### Action items
1. [ ] Mount `/api/payments/webhook` with `express.raw()` ahead of `express.json()` so signature verification sees the untouched body.
2. [ ] Insert into `WebhookEvent` before dispatching on `stripeEvent.type`; treat a duplicate key as success, not an error.
3. [ ] Write every webhook-driven state transition as a `findOneAndUpdate` guarded on the expected current status.
4. [ ] Document the `stripe listen` local-development requirement prominently in the README.

---

## ADR-012: Nodemailer + notify.lk REST, over a transactional email API and Twilio, for notifications

**Status:** Accepted · **Date:** [date] · **Deciders:** Developer (sole)

### Context
Real payment (ADR-009) creates events worth telling a customer about outside the app: a booking confirmed, a booking cancelled and refunded, an event the customer holds tickets for being cancelled, a payment attempt failing. Two channels are needed — email and SMS (the latter driven by the brief's Sri Lankan user base and the `phone` field now required at registration). For each channel there is a choice between a dedicated transactional provider/SDK and a simpler, more manual integration.

### Decision
Use **nodemailer** against a plain SMTP transport (Ethereal as a zero-config development fallback) for email, and a direct **notify.lk REST call via Node 22's global `fetch`** for SMS — no email-provider SDK, no SMS-provider SDK, no added HTTP client dependency.

### Options considered

**Option A — nodemailer (SMTP) + notify.lk REST (chosen)**

**Pros:** no proprietary SDK lock-in — nodemailer speaks plain SMTP, so any provider (Gmail app password, Mailtrap, a university SMTP relay) works without code changes, and Ethereal (`nodemailer.createTestAccount()`) gives a working demo with zero setup and a preview URL logged to the console; notify.lk's REST API is four form fields over `fetch`, needing no dependency at all; both fit an 80-hour solo budget without a new account-provisioning dependency beyond what §A9's plan already assumes.
**Cons:** SMTP and a notify.lk account balance are now genuine operational dependencies the team (in this case, the solo developer) must keep funded and configured — a dead SMTP host or an empty notify.lk balance silently stops one channel; no built-in delivery-analytics dashboard beyond what each provider offers directly.

**Option B — A transactional email API (e.g. SendGrid, Postmark, Resend) + Twilio for SMS**

**Pros:** richer deliverability tooling, dashboards, and delivery webhooks out of the box; Twilio is the de facto standard for programmable SMS with mature client libraries.
**Cons:** two more third-party accounts and API keys to provision and protect (on top of Stripe, ADR-010), each with its own SDK to learn; Twilio in particular is priced and geographically routed in a way that does not naturally suit Sri Lankan mobile numbers as well as a Sri Lanka-specific provider (notify.lk) does; the added SDK surface (two more `npm` dependencies with their own transitive trees) buys deliverability guarantees this coursework-scale system does not need to demonstrate. Rejected as more operational and dependency surface for a requirement that a plain SMTP transport and a four-field REST call already satisfy.

### Trade-off analysis
The decisive factor is the same one that shaped ADR-006 (no caching layer): don't add infrastructure a requirement doesn't actually need. Nodemailer's provider-agnosticism is a direct asset here — Ethereal's zero-setup fallback means a marker running the system for the first time gets a working notification demo (a preview URL in the server log) without provisioning anything, which a transactional-API option would not offer as cheaply. notify.lk is the natural fit for the Sri Lankan phone numbers this system's `phone` field is normalised around, and its REST shape is simple enough that a dependency (Twilio's SDK) buys nothing a native `fetch` call doesn't already provide.

**The trade-off is honestly an operational one, not a technical one:** SMTP credentials and a notify.lk account balance are two new things that can silently run out or misconfigure, and unlike Stripe's near-100%-uptime API, a personal/free-tier SMTP relay or a low notify.lk balance is a realistic failure mode during development or a live demo. This is why the companion architectural decision matters as much as the provider choice: **notifications are explicitly best-effort and architecturally cannot block or fail a booking.** `notificationService`'s every exported function wraps its work in a `safely()` helper that catches and logs rather than propagates (`server/src/services/notification/notificationService.js`), so a dead SMTP host or an empty notify.lk balance degrades to "no email/SMS sent, logged as a warning" rather than "the booking failed" — the cost of the operational dependency is capped at "a notification didn't arrive," never "the transaction didn't complete."

### Consequences
- **Easier:** zero-config development (Ethereal) and a simple, swappable SMTP target in production; no SMS SDK to learn; fewer third-party accounts than Option B; the fire-and-forget design means a notification-channel outage is never a production incident for the booking flow itself.
- **Harder:** two more environment-variable groups (`SMTP_*`, `NOTIFYLK_*`) to configure and keep valid; no delivery-webhook feedback loop, so a silently-bounced email or an unaccepted SMS is only visible in logs, not proactively surfaced; notify.lk's `NotifyDEMO` sender is explicitly documented as unsuitable for OTP-style content, a constraint that must be remembered if the message templates are ever extended.
- **Revisit when:** notification volume or delivery-analytics requirements grow past what log inspection can reasonably support — the migration path is to swap the SMTP transport for a transactional provider's SMTP endpoint (no code change, since nodemailer already speaks SMTP) before reaching for a dedicated SDK.

### Action items
1. [ ] Document `SMTP_*` and `NOTIFYLK_*` variables in `server/.env.example` with guidance on Ethereal as a no-setup fallback.
2. [ ] Ensure every `notificationService` export is wrapped so a failure never propagates to the caller.
3. [ ] Note the notify.lk `NotifyDEMO` OTP-content restriction where SMS templates are authored.

---
# Part C — Software Requirements Specification

*Structured to IEEE-830 conventions.*

## C1. Introduction

### C1.1 Purpose
This SRS specifies the functional and non-functional requirements for Encore, baselining system behaviour before implementation. It is the reference against which design, implementation, and testing are validated.

### C1.2 Scope
As defined in §A4. Encore is a distributed booking system: a React client, a Node.js API, MongoDB storage, and a WebSocket channel for realtime seat state.

### C1.3 Definitions and abbreviations

| Term | Meaning |
|---|---|
| CRUD | Create, Read, Update, Delete |
| JWT | JSON Web Token |
| UAT | User Acceptance Testing |
| Actor | A user type interacting with the system |
| Seat state | One of `available`, `held`, `booked` (v2.3: `held` added by ADR-009) |
| Hold | A time-boxed reservation (`pending` booking + `held` seats) that lapses to `available`/`expired` if unpaid within `HOLD_TTL_MINUTES` (ADR-009) |
| Room | A Socket.IO channel scoped to one event, or to one user's own bookings (`user:<id>`, v2.3) |
| TOCTOU | Time-of-check-to-time-of-use (a class of race condition) |

### C1.4 References
IEEE Std 830 (SRS guidance); PUSL3120 assessment brief; Encore Design System v1.0; ADR-001 to ADR-006.

## C2. Overall description

### C2.1 Product perspective
A new, self-contained system with three deployable containers (client, API, database) plus a realtime channel. No dependency on legacy systems.

### C2.2 Product functions (summary)
Account management; event browsing and search; interactive seat selection with live availability; booking creation and cancellation; admin management of events, venues, and bookings.

### C2.3 Operating environment
Modern evergreen browsers (client); Node.js LTS runtime (server), containerised and orchestrated by `docker-compose`; MongoDB Atlas managed replica set (data), hosted externally and reached over TLS. The API requires outbound network access to Atlas and a `MONGODB_URI` environment variable at startup.

### C2.4 Design and implementation constraints
React frontend written in TypeScript; Node.js-only backend written in JavaScript (ADR-008); MongoDB-only database; WebSockets mandatory; distributed across containers; no other server/language permitted (per brief).

## C3. Actors

| Actor | Description | Authentication |
|---|---|---|
| Visitor | Unauthenticated; browses events, registers | None |
| Customer | Registered user; books and manages own tickets | JWT, role `customer` |
| Administrator | Manages events, venues, and all bookings | JWT, role `admin` |

## C4. Functional requirements

Prioritised with **MoSCoW** (M = Must, S = Should, C = Could). Each requirement is atomic, testable, and traces to an actor and an entity.

### C4.1 Authentication and accounts

| ID | Pri | Requirement | Acceptance criterion |
|---|---|---|---|
| FR-1 | M | A visitor can register with name, email, password | Password stored as a bcrypt hash; plaintext never persisted or logged |
| FR-2 | M | A registered user can log in | Valid credentials return a signed JWT; invalid return 401 with no detail on which field failed |
| FR-3 | M | Protected routes reject requests without a valid JWT | Missing/expired/tampered token returns 401 |
| FR-4 | M | Role-based authorisation is enforced server-side | A customer calling an admin route receives 403 |
| FR-5 | S | A user can view and update their own profile | Update affects only the authenticated user's record |
| FR-6 | C | A user can delete their account | Account removed; existing bookings anonymised |

### C4.2 Events (entity: Event)

| ID | Pri | Requirement | Acceptance criterion |
|---|---|---|---|
| FR-7 | M | Any user can view a list of upcoming events | Returns events with date ≥ today, paginated |
| FR-8 | M | Any user can view a single event's detail | Includes artist, venue, date, price, full seat map |
| FR-9 | S | A user can search/filter events | Filter by artist, date range, or venue returns matching subset |
| FR-10 | M | An admin can create an event | Event persists with a seat map derived from its venue |
| FR-11 | M | An admin can update an event | Changes persist; existing bookings unaffected |
| FR-12 | M | An admin can delete/cancel an event | Event removed or marked cancelled; affected bookings marked cancelled |

### C4.3 Seat map and realtime

| ID | Pri | Requirement | Acceptance criterion |
|---|---|---|---|
| FR-13 | M | Event detail shows a seat map with per-seat state | Each seat renders as available, selected, or taken, colour- and label-distinct |
| FR-14 | M | A booking on one client updates all other clients viewing that event | Other clients reflect the change within 1s (p95) without refresh |
| FR-15 | M | Concurrent bookings of the same seat are prevented | Under 50 simultaneous requests for one seat, exactly one succeeds |
| FR-16 | S | A client reconnecting after disconnection sees correct seat state | On reconnect the client re-fetches authoritative state |

### C4.4 Bookings (entity: Booking)

| ID | Pri | Requirement | Acceptance criterion |
|---|---|---|---|
| FR-17 | M | A customer can book one or more available seats | 201 with booking id and seat detail; seats become unavailable |
| FR-18 | M | A customer can view their own bookings | Returns only the authenticated user's bookings |
| FR-19 | S | A customer can cancel their booking | Booking status becomes cancelled; seats return to available and broadcast |
| FR-20 | M | A confirmation with seat/section/price is shown after booking | Confirmation displays booking reference and all booked seats |
| FR-21 | M | A real payment, via a Stripe Checkout Session with the embedded Payment Element, precedes confirmation *(v2.3: rewritten from a simulated payment — ADR-009, ADR-010)* | `POST /api/bookings` returns a `pending` booking and a `clientSecret`; the booking is confirmed only on receipt of a signature-verified `checkout.session.completed`/`payment_intent.succeeded` webhook (ADR-011), never by the client's own post-payment callback |
| FR-26 | M | *(v2.3, new)* A booked-but-unpaid seat is held for a bounded time, not indefinitely | On booking creation the seat moves `available → held`; if the booking is still `pending` when `holdExpiresAt` passes, the hold reaper (60s sweep) releases the seat to `available` and marks the booking `expired` |
| FR-27 | S | *(v2.3, new)* An email confirmation is sent on successful payment | A `booking-confirmed` email (reference, one stub per seat, total) is sent to the customer's address once the webhook marks the booking `confirmed`; an SMTP failure is logged and never fails the triggering request |
| FR-28 | S | *(v2.3, new)* An SMS confirmation is sent on successful payment | A `booking-confirmed` SMS is sent via notify.lk to the customer's normalised Sri Lankan mobile number once the webhook marks the booking `confirmed`; a delivery failure is logged and never fails the triggering request |
| FR-29 | S | *(v2.3, new)* A refund is issued when a paid booking is cancelled | Cancelling a `confirmed` booking triggers `stripe.refunds.create` against its `paymentIntentId` **before** the booking's status changes to `cancelled`, so a refund failure cannot leave a "cancelled but unrefunded" booking |

### C4.5 Venues (entity: Venue)

| ID | Pri | Requirement | Acceptance criterion |
|---|---|---|---|
| FR-22 | S | An admin can create, read, update, and delete venues | Full CRUD; deletion blocked if events reference the venue |
| FR-23 | S | An event references a venue and inherits its seat layout | Created event's seat array matches the venue layout |

### C4.6 Administration

| ID | Pri | Requirement | Acceptance criterion |
|---|---|---|---|
| FR-24 | M | An admin can view all bookings across events | Returns bookings for all users, paginated |
| FR-25 | S | An admin can view capacity/utilisation per event | Shows booked vs total seats per event |

**CRUD coverage:** the brief requires CRUD for ≥3 entities. Encore provides full CRUD for **four** — User, Event, Booking, Venue.

## C5. Non-functional requirements

Each is stated with a measurable target so it can be verified rather than asserted.

| ID | Category | Requirement | Target / verification |
|---|---|---|---|
| NFR-1 | Performance | Seat-state updates propagate to other clients quickly | ≤1s p95; measured in system test |
| NFR-2 | Performance | API reads respond promptly under expected load | p95 <200 ms at 20 req/s |
| NFR-3 | Security | Passwords hashed; state-changing endpoints require valid JWT; card data never reaches the server | bcrypt cost ≥10, verified by integration tests; payment card data is tokenised entirely client-side by Stripe's embedded Payment Element (§A12), so the server carries minimal PCI scope (SAQ A) |
| NFR-4 | Security | Input validated and sanitised; no sensitive data in query strings | Rejection tests for malformed and injected payloads |
| NFR-5 | Security | Auth endpoints rate-limited | Repeated failed logins throttled |
| NFR-5a | Security | No credentials in source control | Database URI and JWT secret supplied only via environment variables; repository scanned before submission |
| NFR-6 | Reliability | No double-booking under concurrency | Zero duplicates in 50-request concurrency test (O7) |
| NFR-7 | Reliability | API recovers from transient database disconnection | Health endpoint reflects DB state; requests fail cleanly, not silently |
| NFR-8 | Portability | Runs on any Docker host given required environment variables | `docker-compose up` with a populated `.env` yields a working stack on a clean machine; `.env.example` documents every required variable |
| NFR-9 | Maintainability | Layered structure, shared tokens, lint-clean | ESLint passes in CI with zero errors on both client and server |
| NFR-9a | Maintainability | Client compiles under TypeScript strict mode | `tsc --noEmit` passes in CI with zero errors; no `any` on API response types |
| NFR-9b | Correctness | API contract verified despite the language seam | Every endpoint in §C7.1 covered by an integration test asserting response shape (ADR-008) |
| NFR-10 | Maintainability | Server line coverage ≥70% | Reported by Jest in CI |
| NFR-11 | Usability | Seat states distinguishable without relying on colour alone | Verified in UAT and accessibility check |
| NFR-12 | Accessibility | Keyboard navigable, visible focus, reduced motion respected | Automated axe check plus manual keyboard pass |

## C6. Data model

### C6.1 Entity relationships

```
   User ──< Booking >── Event ──> Venue
    1      n      n      1    n     1

   User    1 ──< n  Booking      a user has many bookings
   Event   1 ──< n  Booking      an event has many bookings
   Venue   1 ──< n  Event        a venue hosts many events
```

### C6.2 Schema definitions

**User**

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `name` | String | required, 2–80 chars |
| `email` | String | required, unique, lowercase, valid format |
| `passwordHash` | String | required, bcrypt, never returned by API |
| `phone` | String | *(v2.3, new)* required, normalised Sri Lankan mobile `94XXXXXXXXX` (`^94[1-9][0-9]{8}$`); required at registration and used as the notify.lk SMS destination |
| `role` | String | enum `customer` \| `admin`, default `customer` |
| `createdAt` | Date | auto |

**Venue**

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `name` | String | required |
| `address` | String | required |
| `city` | String | *(v2.3, new)* required — surfaced on event listings as `venue.city` |
| `seatLayout` | Array of `{id, section, row, number}` | required, ≤500 seats (ADR-002) |
| `capacity` | Number | derived from layout length |

**Event**

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `title` | String | required |
| `artist` | String | required |
| `genre` | String | *(v2.3, new)* required — powers the client's genre filter |
| `imageUrl` | String | *(v2.3, new)* optional |
| `description` | String | *(v2.3, new)* optional |
| `date` | Date | required, must be future on creation |
| `basePrice` | Number | required, ≥0 |
| `venueRef` | ObjectId → Venue | required |
| `seats` | Array of `{id, section, row, number, status, price}` | `status` enum `available` \| `held` \| `booked` *(v2.3: `held` added — ADR-009)* |
| `status` | String | enum `scheduled` \| `cancelled` |

**Booking**

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `reference` | String | unique, human-readable (e.g. `ENC-4471`) |
| `userRef` | ObjectId → User | required |
| `eventRef` | ObjectId → Event | required |
| `seats` | Array of `{id, section, row, number, price}` subdocuments *(v2.3: changed from an array of seat id strings — ADR-009)* | required, non-empty; each entry is a **price snapshot** taken at booking time, so a later `basePrice` edit on the event cannot rewrite booking history, and a ticket stub can render from the booking document alone |
| `totalPrice` | Number | computed server-side, never trusted from client |
| `status` | String | enum `pending` \| `confirmed` \| `cancelled` \| `expired`, default `pending` *(v2.3: `pending`/`expired` added — ADR-009)* |
| `holdExpiresAt` | Date | *(v2.3, new)* set on creation to `now + HOLD_TTL_MINUTES`; cleared once the booking leaves `pending`. Drives the hold-reaper sweep (§C6.3) |
| `payment` | Object `{provider, sessionId, paymentIntentId, status, amountMinor, currency, refundId}` | *(v2.3, new)* the Stripe payment record for this booking; `amountMinor` is the Stripe minor-unit amount (LKR ×100), never the display price |
| `createdAt` | Date | auto |

**WebhookEvent** *(v2.3, new — ADR-011)*

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `stripeEventId` | String | required, unique — the idempotency key that makes a replayed Stripe webhook delivery a no-op |
| `type` | String | required — the Stripe event type, for audit/debugging |
| `processedAt` | Date | auto |

### C6.3 Indexes

| Collection | Index | Purpose |
|---|---|---|
| users | `{email: 1}` unique | Login lookup; enforces uniqueness |
| events | `{date: 1, status: 1}` | Upcoming-events listing (FR-7) |
| events | `{artist: "text", title: "text"}` | Search (FR-9) |
| bookings | `{userRef: 1, createdAt: -1}` | "My bookings" (FR-18) |
| bookings | `{eventRef: 1}` | Admin per-event view (FR-25) |
| bookings | `{reference: 1}` unique | Reference lookup |
| bookings | `{status: 1, holdExpiresAt: 1}` *(v2.3, new — ADR-009)* | The hold reaper's query (`{status: 'pending', holdExpiresAt: {$lt: now}}`), run every 60s, plus the same conditional lookup `bookingService.createBooking` uses to reap an event's own stale holds before attempting a new one (FR-26) |
| webhookEvents | `{stripeEventId: 1}` unique *(v2.3, new — ADR-011)* | Idempotency check on webhook delivery; a duplicate key on insert means "already processed" |

`totalPrice` is always recomputed server-side from stored seat prices — a client-supplied price is never trusted.

## C7. Interface specifications

### C7.1 REST API contract

All responses are JSON. All state-changing routes require `Authorization: Bearer <jwt>`.

| Method | Endpoint | Auth | Body / params | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | — | `{name, email, password}` | 201 `{user, token}` | 400 validation, 409 email exists |
| POST | `/api/auth/login` | — | `{email, password}` | 200 `{user, token}` | 401 invalid, 429 throttled |
| GET | `/api/users/me` | Customer | — | 200 `{user}` | 401 |
| PATCH | `/api/users/me` | Customer | `{name?, email?}` | 200 `{user}` | 400, 401, 409 |
| DELETE | `/api/users/me` | Customer | — | 204 | 401 |
| GET | `/api/events` | — | `?page&limit&artist&from&to&venue` | 200 `{events[], total, page}` | 400 bad filter |
| GET | `/api/events/:id` | — | — | 200 `{event, seats[]}` | 404 |
| POST | `/api/events` | Admin | `{title, artist, date, basePrice, venueRef}` | 201 `{event}` | 400, 401, 403 |
| PATCH | `/api/events/:id` | Admin | partial event | 200 `{event}` | 400, 401, 403, 404 |
| DELETE | `/api/events/:id` | Admin | — | 204 | 401, 403, 404 |
| GET | `/api/venues` | — | — | 200 `{venues[]}` | — |
| POST | `/api/venues` | Admin | `{name, address, seatLayout}` | 201 `{venue}` | 400, 403 |
| PATCH | `/api/venues/:id` | Admin | partial venue | 200 `{venue}` | 400, 403, 404 |
| DELETE | `/api/venues/:id` | Admin | — | 204 | 403, 404, 409 in-use |
| POST | `/api/bookings` | Customer | `{eventId, seatIds[]}` | 201 `{booking, clientSecret}` *(v2.3: booking is `pending`, seats `held`, not `booked`/`confirmed` — ADR-009)* | 400, 401, **409 seat taken**, 404 |
| GET | `/api/bookings/me` | Customer | `?page&limit` | 200 `{bookings[]}` | 401 |
| GET | `/api/bookings/:id` | Customer (owner) / Admin | — | 200 `{booking}` *(v2.3, new)* | 401, 403 not owner, 404 |
| POST | `/api/bookings/:id/payment-session` | Customer (owner) | — | 200 `{clientSecret, publishableKey}` *(v2.3, new — re-issues a client secret while the hold is still live, e.g. after a checkout reload)* | 401, 403 not owner, 404, 409 hold no longer pending/expired |
| PATCH | `/api/bookings/:id/cancel` | Customer | — | 200 `{booking}` — refunds via Stripe first if the booking was `confirmed` (FR-29) | 401, 403 not owner, 404, 400 event already started |
| GET | `/api/bookings` | Admin | `?eventId&page&limit` | 200 `{bookings[], total}` | 401, 403 |
| POST | `/api/payments/webhook` | Stripe signature (not JWT) | Raw Stripe event body + `stripe-signature` header | 200 `{received: true}` *(v2.3, new — ADR-011; the authoritative payment→booking confirmation, idempotent on replay via the `WebhookEvent` ledger)* | 400 invalid signature |
| GET | `/api/admin/stats` | Admin | — | 200 dashboard totals: events, bookings, revenue, occupancy *(v2.3, new, FR-25)* | 401, 403 |
| GET | `/api/admin/events` | Admin | `?page&limit` | 200 `{events[], total, page, totalPages}` with `revenue` + `bookingCount` per event; includes cancelled and past events, unlike the public `/api/events` *(v2.3, new, FR-25)* | 401, 403 |
| GET | `/api/health` | — | — | 200 `{status, db}` | 503 db down |

**Error envelope** (uniform across all failures):

```json
{ "error": { "code": "SEAT_UNAVAILABLE",
             "message": "One or more selected seats are no longer available.",
             "details": { "seatIds": ["B-14"] } } }
```

Messages are user-facing and actionable; stack traces and raw driver errors are never returned to the client.

### C7.2 WebSocket event catalogue

Namespace `/`, rooms named `event:<eventId>`. The handshake carries the JWT; unauthenticated sockets may join rooms read-only. *(v2.3, new)* An authenticated socket also auto-joins a private `user:<id>` room on connection, used only for the `booking:updated` event below.

| Direction | Event | Payload | Purpose |
|---|---|---|---|
| Client → Server | `join:event` | `{eventId}` | Subscribe to an event's seat updates |
| Client → Server | `leave:event` | `{eventId}` | Unsubscribe on navigation away |
| Server → Client | `seats:updated` | `{eventId, seatIds[], status}`, `status` one of `available` \| `held` \| `booked` *(v2.3: `held` added — a seat greys out the moment a checkout starts, not only once it is paid, shrinking the ADR-004 conflict window)* | Broadcast after a seat hold, payment confirmation, hold expiry, or cancellation |
| Server → Client | `event:cancelled` | `{eventId}` | Broadcast when an admin cancels an event |
| Server → Client | `booking:updated` | `{bookingId, status}`, to room `user:<id>` *(v2.3, new — ADR-011)* | Broadcast to the owning user's sockets when their booking's status changes via the Stripe webhook (typically `pending → confirmed`), so the confirmation page can update without polling |
| Server → Client | `error` | `{code, message}` | Malformed subscription or auth failure |

Broadcasts are emitted **only after** the database write commits, so no client ever observes a state the server has not persisted.

### C7.3 Error handling and resilience

| Failure | Detection | Behaviour |
|---|---|---|
| Seat taken between selection and submit | `matchedCount === 0` | 409 with the conflicting seat ids; client shows "That seat was just taken" and re-renders from server state |
| Invalid/expired JWT | Verification fails | 401; client clears token and routes to login |
| MongoDB unavailable | Driver error | 503 from health endpoint; requests fail fast with a clear message; no partial writes |
| WebSocket disconnect | Socket.IO `disconnect` | Client auto-reconnects with backoff, rejoins its room, and **re-fetches seat state** rather than trusting cache (mitigates R7) |
| Unhandled server error | Global error middleware | Logged with stack and request id; client receives a generic 500 with no internal detail |
| Malformed request body | Validation middleware (`zod`, NFR-4) | 400 `VALIDATION_ERROR` listing the offending fields |
| Seat hold not paid within `HOLD_TTL_MINUTES` *(v2.3, new — ADR-009)* | Hold-reaper sweep every 60s finds `{status: 'pending', holdExpiresAt: {$lt: now}}` | Booking → `expired`, seats `held → available`, Stripe session expired, `seats:updated` broadcast; the client's countdown redirects to the event with a "Your seat hold expired" message before this fires server-side |
| Stripe webhook delivered more than once *(v2.3, new — ADR-011)* | `WebhookEvent` insert on `stripeEventId` throws a duplicate-key error | 200 `{received: true}` returned immediately with no further processing — Stripe's at-least-once delivery cannot double-confirm a booking |
| Stripe webhook signature invalid *(v2.3, new — ADR-011)* | `stripe.webhooks.constructEvent` throws | 400 `INVALID_SIGNATURE`; the payload is never processed |
| Card payment declined/fails *(v2.3, new)* | `payment_intent.payment_failed` webhook | Booking stays `pending` — the hold is still live, so the user can retry with a different card before it expires; a `payment-failed` email is sent (best-effort) |

**Notification failures never propagate.** *(v2.3, new — ADR-012)* Email (nodemailer) and SMS (notify.lk) sends are fire-and-forget from the caller's perspective and wrapped so a failure is logged, never thrown — a dead SMTP host or a notify.lk outage cannot turn a successful booking or payment into a failed request.

**Retry policy:** the client retries idempotent reads (GET) with exponential backoff up to three attempts. Booking creation is **never** retried automatically, since a blind retry could produce a duplicate booking; the user is instead shown the conflict and asked to choose again.

## C8. Traceability — requirements to design

| Requirement | Design element | ADR |
|---|---|---|
| FR-1–4 | Auth middleware, User model | ADR-005 |
| FR-7–12 | Event controller/service, indexes | ADR-002 |
| FR-13–14 | Seat map component, socket gateway | ADR-003 |
| FR-15 | Atomic conditional update in booking service | ADR-004 |
| FR-16 | Client reconnect handler | ADR-003 |
| FR-17–20 | Booking controller/service | ADR-002, ADR-004 |
| FR-21 | Payment service, Stripe config, webhook controller *(v2.3, new)* | ADR-009, ADR-010, ADR-011 |
| FR-22–23 | Venue controller, seat layout derivation | ADR-002 |
| FR-26 | Booking service (hold TTL), hold-reaper job *(v2.3, new)* | ADR-009 |
| FR-27–28 | Notification service, email/SMS services, webhook confirmation handler *(v2.3, new)* | ADR-011, ADR-012 |
| FR-29 | Booking service cancellation path, payment service refund *(v2.3, new)* | ADR-009, ADR-011 |
| NFR-2 | Indexes, no cache | ADR-006 |
| NFR-3 | Stripe Payment Element (client-side tokenisation) *(v2.3, new)* | ADR-010 |
| NFR-6 | Atomic update | ADR-004 |

## C9. Requirements traceability to rubric

| Rubric category | Satisfied by |
|---|---|
| Analysis (10%) | §A2–A5, §C3–C5 (users, benefits, prioritised testable requirements) |
| Design (20%) | §A6 (component diagram, data flow), §C6–C7 (data model, API contract), Part B (ADRs) |
| Software (30%) | FR-1–29 (CRUD ×4, WebSockets, security, distributed, real payment and notifications *(v2.3)*) |
| Testing (20%) | Part D (pyramid, coverage targets, four levels, example cases) |
| CI/CD (10%) | §A9, §D7 (pipeline from S0) |
| Evaluation (10%) | O1–O7 success criteria; ADR "revisit when" triggers, including ADR-004's firing in ADR-009 *(v2.3)* |

---
# Part D — Test Strategy and Plan

## D1. Testing philosophy

Testing follows the **testing pyramid**: many fast unit tests over business logic, a smaller band of integration tests over the HTTP and database boundary, and a few slow, high-confidence end-to-end tests over the critical user journeys.

```
                    ╱────────────╲
                   ╱   System /   ╲        ~6 tests   slow, high confidence
                  ╱      E2E       ╲
                 ╱──────────────────╲
                ╱    Integration     ╲     ~30 tests  medium speed
               ╱   (API + database)   ╲
              ╱────────────────────────╲
             ╱       Unit tests         ╲  ~70 tests  fast, focused
            ╱   (services, helpers)      ╲
           ╱──────────────────────────────╲

           Plus: usability (UAT) and static analysis alongside
```

The shape matters: an inverted pyramid (mostly E2E) is slow and brittle; an all-unit suite misses the integration faults that actually break this system. The distribution above is the target, not a prediction.

## D2. What to test — and what not to

**Prioritised for coverage:**

- **Business-critical paths** — registration, login, seat booking, cancellation. A fault here fails the project.
- **Security boundaries** — every authorisation check: unauthenticated access, wrong-role access, and cross-user access (customer A reading customer B's bookings).
- **Data integrity** — the concurrency guarantee (O7), server-side price computation, referential rules.
- **Error handling** — the 409 conflict path, validation rejection, database-unavailable behaviour.
- **Edge cases** — booking zero seats, booking already-booked seats, past-dated events, empty result sets, pagination boundaries.

**Deliberately not tested** (documenting exclusions is part of a defensible strategy):

- Mongoose and Express framework internals — third-party code with its own suites.
- Trivial pass-through getters and DTO mappers with no logic.
- Exact CSS values and visual styling — covered by manual review, not assertions.
- One-off seed and migration scripts.

## D3. Coverage targets

| Area | Target | Rationale |
|---|---|---|
| Server overall (line) | ≥70% | Meets NFR-10; enforced in CI |
| Services layer | ≥85% | Where the domain logic lives |
| Auth middleware | 100% branch | Security boundary — every path matters |
| Booking service | ≥90% | Highest-risk component (ADR-004) |
| React components | ≥60% | Interaction over rendering detail |

Coverage is a floor for confidence, not a goal in itself; a high percentage over trivial code is not evidence of quality, so the report will discuss *what* is covered, not only how much.

## D4. Test levels

### D4.1 Unit tests (Jest)

Isolated, no network or database — dependencies are mocked.

| Target | Example cases |
|---|---|
| `authService.hashPassword` | Produces a bcrypt hash; hash differs across calls for the same input; verify succeeds only for the correct password |
| `authService.verifyToken` | Valid token returns payload; expired token throws; tampered signature throws |
| `bookingService.calculateTotal` | Sums seat prices correctly; returns 0 for empty selection; ignores any client-supplied price |
| `seatService.getAvailability` | Counts available vs booked; handles a fully booked event; handles an empty layout |
| `validators` | Rejects malformed email, short password, non-array `seatIds`, empty `seatIds` |
| `roleGuard` | Allows admin, rejects customer with 403, rejects anonymous with 401 |

### D4.2 Integration tests (Jest + Supertest)

Real Express app against an ephemeral `mongodb-memory-server` instance, exercising the full HTTP → controller → service → database path. Tests deliberately do **not** hit Atlas: this keeps the suite fast, removes a network dependency from CI, avoids shared-tier connection limits, and guarantees no test can corrupt development or demonstration data. Because `mongodb-memory-server` runs a real MongoDB binary, single-document atomicity behaves identically to Atlas, so the concurrency guarantee (ADR-004) is genuinely exercised.

| Target | Example cases |
|---|---|
| `POST /api/auth/register` | 201 and token on valid input; 409 on duplicate email; password hash never present in the response body |
| `POST /api/auth/login` | 200 with token; 401 on wrong password; error message does not reveal whether the email exists |
| `GET /api/events` | Returns only future events; pagination respects `page`/`limit`; filter by artist narrows results |
| `POST /api/events` | Admin token succeeds; customer token returns 403; no token returns 401 |
| `POST /api/bookings` | 201 marks seats booked and persists a booking; 409 when a seat is already booked; total price computed server-side and ignores a spoofed `totalPrice` in the body |
| `GET /api/bookings/me` | Returns only the caller's bookings; a second user's bookings are absent; **response shape matches the client's declared `BookingResponse` type** |
| `PATCH /api/bookings/:id/cancel` | Owner can cancel; a different customer receives 403; cancelled seats return to available |
| `DELETE /api/venues/:id` | 409 when events reference the venue |

### D4.3 Concurrency test (the critical one)

A dedicated integration test targeting O7 and FR-15, run in CI on every push:

> Seed one event with a single available seat. Fire 50 simultaneous `POST /api/bookings` requests for that seat from 50 authenticated users. **Assert:** exactly one response is 201, exactly 49 are 409, exactly one Booking document exists, and the seat's status is `booked`.

This test is the direct evidence that the ADR-004 decision works, and is the single most valuable test in the suite.

### D4.4 System / end-to-end tests

Few, slow, covering complete journeys through the running stack.

| Journey | Steps |
|---|---|
| Register → browse → book → confirm | New user registers, opens an event, selects two seats, books, sees a confirmation with a reference |
| Realtime propagation | Two browser contexts open the same event; a booking in context A turns those seats grey in context B without a refresh, within 1s |
| Admin lifecycle | Admin logs in, creates a venue, creates an event on it, sees it in the public listing, cancels it |
| Cancellation round-trip | Customer cancels a booking; seats return to available and the change broadcasts to a second client |
| Auth enforcement | Direct navigation to an admin route as a customer is blocked |
| Reconnect recovery | Client disconnects, a booking occurs elsewhere, client reconnects and shows correct state |

### D4.5 Frontend component tests (React Testing Library)

| Target | Example cases |
|---|---|
| `SeatMap` | Renders one element per seat; clicking an available seat selects it; clicking a taken seat does nothing; a `seats:updated` event re-renders affected seats |
| `BookingForm` | Submit disabled with no seats selected; shows the 409 conflict message when the API returns one |
| `LoginForm` | Shows an inline validation error on empty email; clears the error on edit |
| `EventList` | Renders an empty state when no events are returned |

Accessibility is asserted here too: `axe` runs against key components, and a manual keyboard pass verifies focus order and visible focus rings (NFR-12).

Because the client is TypeScript, `tsc --noEmit` acts as a further verification layer ahead of these tests: shape errors in seat state and socket payloads surface at compile time rather than as runtime test failures. Response and payload types live in a single `types/api.ts` module so that any API change has exactly one place to be reflected (ADR-008).

### D4.6 Usability testing (UAT)

| Aspect | Plan |
|---|---|
| Participants | Target 5, minimum 3 (5 is the established point of diminishing returns for usability findings) |
| Protocol | Task-based, think-aloud. Tasks: (1) register, (2) find a named artist's concert, (3) book two adjacent seats — now exercising the real Stripe hold-then-pay flow, ADR-009/ADR-010 — (4) find your booking reference, (5) cancel it and confirm the refund |
| Measures | Task completion rate, time on task, errors, observed points of confusion, short post-task rating |
| Ethics | Informed consent obtained, purpose explained, right to withdraw, results anonymised, no personal data retained — per University requirements |
| Output | Findings ranked by severity, the modifications made in response, and a re-test of any changed flow |

Recording *what changed as a result* is essential — the rubric's top band explicitly asks for resultant modifications, not merely that testing happened. **The full runnable protocol — session script, the informed-consent wording, and the findings/modifications record — is `docs/uat-plan.md` (v2.3, new); this table summarises it.**

### D4.7 Static analysis

- **ESLint** across client (`@typescript-eslint`) and server; zero errors required for the pipeline to pass.
- **TypeScript compiler** (`tsc --noEmit`, strict mode) on the client; type errors fail the build. Compiler strictness is itself a static-analysis metric worth reporting.
- **Metrics captured for the report:** total files and lines, rule violations found and fixed over time, complexity warnings, and the count of type errors resolved during development (evidence the TypeScript investment paid off — useful material for the Evaluation section).
- **Point-in-time snapshot: `docs/static-analysis.md` (v2.3, new)** records an actual run of these checks (not an estimate) — file/line counts and the exact ESLint/`tsc` findings at time of writing, with each finding's root cause identified and a re-run required before submission.

## D5. Test data and environments

| Environment | Database | Purpose |
|---|---|---|
| Local development | Atlas `encore_dev` database | Day-to-day work |
| Automated test (local + CI) | `mongodb-memory-server`, ephemeral | Fast, isolated, no network dependency, no tier limits |
| Concurrency test (D4.3) | `mongodb-memory-server` | Avoids shared-tier throttling (R12) while still exercising real MongoDB atomicity |
| Demonstration / UAT | Atlas `encore_demo` database, seeded | Video demo and usability sessions |

**Test data strategy:** a seed script creates a known fixture set — two venues, four events across future dates, an admin, and three customers. Each integration suite resets the database before running so tests never depend on ordering or on residue from earlier tests. No real personal data is used at any point.

## D6. Traceability — requirements to tests

| Req | Unit | Integration | System | Component | UAT |
|---|---|---|---|---|---|
| FR-1 registration | ✔ | ✔ | ✔ | ✔ | ✔ |
| FR-2 login | ✔ | ✔ | ✔ | ✔ | ✔ |
| FR-3 JWT protection | ✔ | ✔ | ✔ | — | — |
| FR-4 role authorisation | ✔ | ✔ | ✔ | — | — |
| FR-5/6 profile | ✔ | ✔ | — | — | — |
| FR-7/8 event listing + detail | ✔ | ✔ | ✔ | ✔ | ✔ |
| FR-9 search | ✔ | ✔ | — | ✔ | ✔ |
| FR-10–12 event admin CRUD | ✔ | ✔ | ✔ | — | — |
| FR-13 seat map | ✔ | — | ✔ | ✔ | ✔ |
| FR-14 realtime broadcast | — | ✔ | ✔ | ✔ | ✔ |
| **FR-15 no double-booking** | ✔ | **✔ (D4.3)** | ✔ | — | — |
| FR-16 reconnect | — | — | ✔ | ✔ | — |
| FR-17/18 booking create + read | ✔ | ✔ | ✔ | ✔ | ✔ |
| FR-19 cancellation | ✔ | ✔ | ✔ | — | ✔ |
| FR-20 confirmation | — | ✔ | ✔ | ✔ | ✔ |
| FR-21 real Stripe payment *(v2.3: rewritten from simulated payment)* | ✔ | ✔* | ✔† | ✔† | ✔† |
| FR-22/23 venues | ✔ | ✔ | ✔ | — | — |
| FR-24/25 admin views | ✔ | ✔ | — | — | ✔ |
| FR-26 seat hold with TTL *(v2.3, new)* | ✔ | —† | ✔† | — | — |
| FR-27 email confirmation *(v2.3, new)* | ✔ | —† | ✔† | — | — |
| FR-28 SMS confirmation *(v2.3, new)* | ✔ | —† | ✔† | — | — |
| FR-29 refund on cancellation *(v2.3, new)* | ✔* | —† | ✔† | — | — |
| NFR-1 latency | — | — | ✔ | — | — |
| NFR-3/4/5 security | ✔ | ✔ | ✔ | — | — |
| NFR-6 integrity | ✔ | ✔ | — | — | — |
| NFR-12 accessibility | — | — | — | ✔ | ✔ |

Every "Must" requirement is covered at two or more levels.

**v2.3 coverage notes, stated honestly rather than rounded up:**
- `✔*` — partially covered: the underlying Stripe call is unit-tested in isolation (`tests/unit/paymentService.test.js` covers `refundPayment`; `tests/integration/api.integration.test.js` covers booking creation opening a mocked Stripe session and returning `pending`), but the specific end-to-end flow named by the requirement (webhook-driven confirmation for FR-21; cancel-a-confirmed-booking-and-refund for FR-29) does not yet have its own integration test.
- `✔†` / `—†` — planned, not yet built at the time of this amendment: `tests/integration/payments.webhook.test.js` and `tests/integration/notifications.test.js` (§D4.2), the Playwright system journeys (§D4.4), and the client Vitest/RTL component suite (§D4.5) are specified but had not landed in the repository when this SRS section was amended. This is a point-in-time snapshot, to be closed out and re-verified before submission — see `docs/static-analysis.md`.
- FR-27/FR-28 unit tests (`tests/unit/emailService.test.js`, `tests/unit/smsService.test.js`, `tests/unit/phone.test.js`) verify template content, truncation, brand-prefixing, and that a transport/API failure never throws — but not that `notificationService` is actually invoked at the right point in the webhook handler under integration conditions.

## D7. Testing in the CI/CD pipeline

The GitHub Actions pipeline runs on every push and pull request, in this order — fastest feedback first:

1. **Install** dependencies (cached).
2. **Lint** — ESLint on client (`@typescript-eslint`) and server; fail fast on errors.
3. **Type-check** — `tsc --noEmit` on the client; catches type regressions before any test runs (NFR-9a).
4. **Unit tests** — seconds; catch most regressions immediately.
5. **Integration tests** — against an ephemeral `mongodb-memory-server` instance, so the pipeline never depends on Atlas availability or network rules. These also assert response shape, standing in for the compile-time API contract the language split forgoes (NFR-9b, ADR-008).
6. **Concurrency test** (D4.3) — guards the system's core correctness property.
7. **Coverage report** — fails the build below the NFR-10 threshold.
8. **Build** — production client bundle (TypeScript compiled) and Docker images.

System/E2E tests run on demand and before each milestone rather than on every push, since their runtime would slow the feedback loop. This staging of the suite is itself a deliberate trade-off worth describing in the report.

## D8. Known gaps and residual risk

Stated honestly rather than omitted:

- **Load testing is not performed.** The estimates in §A7 are analytical, not measured. Acceptable at this scale; a load test would be the first addition if the system were to go live.
- **No cross-browser matrix.** Testing targets current Chrome and Firefox only.
- **No security penetration testing.** Security is verified through authorisation tests and input validation, not adversarial testing.
- **Single-instance realtime is untested at scale.** With one server instance, cross-instance broadcast (the Redis adapter path in ADR-003) is neither implemented nor exercised.
- **The API contract is not compile-time verified.** The TypeScript client and JavaScript server split (ADR-008) means client response types are asserted by integration tests rather than guaranteed by a shared type. A drifting endpoint would be caught in CI, not in the editor.

---

## Appendix — coursework requirement checklist

| Brief requirement | Where addressed |
|---|---|
| Chosen topic (Cinema/Event Booking family) | Title, §A1 |
| React frontend (client-side code is TypeScript, permitted by the brief) | §A6.3, §C2.4, ADR-008 |
| Node.js backend (server-side code is JavaScript) | §A6, ADR-001, ADR-008 |
| MongoDB database via web-service API | §C6, §C7.1, ADR-002 |
| WebSockets for multi-client appearance | FR-13–16, §C7.2, ADR-003 |
| Interactive (keyboard/mouse) | §C2.3, NFR-12 |
| Distributed across containers/computers | §A6.2 (client + API containers, external Atlas replica set), NFR-8, ADR-007 |
| Database is MongoDB (permitted type) | §C6, ADR-002, ADR-007 |
| Credentials kept out of source control | §A6.4, NFR-5a, R9, ADR-007 |
| Security (registration/login) | FR-1–4, NFR-3–5, ADR-005 |
| CRUD for ≥3 entities | §C4 (four entities) |
| 80+ hours of effort | §A9 (six sprints) |
| Component architecture documented | §A6.2, §A6.3, §C6.1 |
| Class/data structures | §C6.2 |
| Design practices (SOLID/DRY/MVC) | §A6.3, Part B |
| Testing: unit | §D4.1 |
| Testing: integration | §D4.2 |
| Testing: system | §D4.4 |
| Testing: UAT with participants + protocol + results | §D4.6 |
| Static code analysis metrics | §D4.7 |
| CI/CD pipeline | §D7, §A9 |
| Evaluation basis | O1–O7, ADR "revisit when" triggers, §D8 |
| Permitted AI use only | §A4.3, §A12 |

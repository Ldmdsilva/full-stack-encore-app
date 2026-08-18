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
| Status | Baselined for development |
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

**Contents**

- **Part A — Project Initiation Document** (§A1–A12)
- **Part B — Architecture Decision Records** (ADR-001 to ADR-008)
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
- Automated test suites and a CI/CD pipeline.
- Containerised deployment (client, server, database).

### A4.2 Out of scope

- Real payment processing (a mocked/simulated payment step is used; no live card handling — this also keeps the project clear of handling real financial credentials).
- Native mobile apps.
- Email/SMS delivery infrastructure (booking confirmation is shown in-app).
- Horizontal scaling of the WebSocket layer across multiple server instances (single-instance only; see ADR-003 consequences).
- Third-party integrations beyond those needed to satisfy the brief.

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
- **Key signals to watch:** 5xx rate, booking-conflict (409) rate, WebSocket connection count, p95 booking latency.
- **Atlas-side observability:** the provider dashboard supplies connection counts, slow-query logs, and storage usage at no implementation cost — used to verify the §C6.3 indexes are actually being hit.

## A12. Ethics, security, and academic integrity

- **Ethics:** usability testing follows University ethical guidelines — participant consent, right to withdraw, anonymised results.
- **Security:** passwords hashed with bcrypt (cost 10+); JWT for session auth with expiry; role-based authorisation enforced server-side; input validation on all endpoints; rate limiting on auth routes; no sensitive data in query strings; no real financial data handled.
- **Academic integrity:** all work is the developer's own; sources referenced; generative AI used only within the brief's permitted assistive categories.

---
# Part B — Architecture Decision Records

Eight decisions material enough to warrant a record. Each states the forces at play, the options genuinely considered, the trade-offs, and what the decision makes harder — not just what it makes easier.

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
| Seat state | One of `available`, `booked` |
| Room | A Socket.IO channel scoped to one event |
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
| FR-21 | C | A simulated payment step precedes confirmation | No real card data is collected or transmitted |

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
| NFR-3 | Security | Passwords hashed; state-changing endpoints require valid JWT | bcrypt cost ≥10; verified by integration tests |
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
| `role` | String | enum `customer` \| `admin`, default `customer` |
| `createdAt` | Date | auto |

**Venue**

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `name` | String | required |
| `address` | String | required |
| `seatLayout` | Array of `{id, section, row, number}` | required, ≤500 seats (ADR-002) |
| `capacity` | Number | derived from layout length |

**Event**

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `title` | String | required |
| `artist` | String | required |
| `date` | Date | required, must be future on creation |
| `basePrice` | Number | required, ≥0 |
| `venueRef` | ObjectId → Venue | required |
| `seats` | Array of `{id, section, row, number, status, price}` | `status` enum `available` \| `booked` |
| `status` | String | enum `scheduled` \| `cancelled` |

**Booking**

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | PK |
| `reference` | String | unique, human-readable (e.g. `ENC-4471`) |
| `userRef` | ObjectId → User | required |
| `eventRef` | ObjectId → Event | required |
| `seats` | Array of seat ids | required, non-empty |
| `totalPrice` | Number | computed server-side, never trusted from client |
| `status` | String | enum `confirmed` \| `cancelled` |
| `createdAt` | Date | auto |

### C6.3 Indexes

| Collection | Index | Purpose |
|---|---|---|
| users | `{email: 1}` unique | Login lookup; enforces uniqueness |
| events | `{date: 1, status: 1}` | Upcoming-events listing (FR-7) |
| events | `{artist: "text", title: "text"}` | Search (FR-9) |
| bookings | `{userRef: 1, createdAt: -1}` | "My bookings" (FR-18) |
| bookings | `{eventRef: 1}` | Admin per-event view (FR-25) |
| bookings | `{reference: 1}` unique | Reference lookup |

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
| POST | `/api/bookings` | Customer | `{eventId, seatIds[]}` | 201 `{booking}` | 400, 401, **409 seat taken**, 404 |
| GET | `/api/bookings/me` | Customer | `?page&limit` | 200 `{bookings[]}` | 401 |
| PATCH | `/api/bookings/:id/cancel` | Customer | — | 200 `{booking}` | 401, 403 not owner, 404 |
| GET | `/api/bookings` | Admin | `?eventId&page&limit` | 200 `{bookings[], total}` | 401, 403 |
| GET | `/api/health` | — | — | 200 `{status, db}` | 503 db down |

**Error envelope** (uniform across all failures):

```json
{ "error": { "code": "SEAT_UNAVAILABLE",
             "message": "One or more selected seats are no longer available.",
             "details": { "seatIds": ["B-14"] } } }
```

Messages are user-facing and actionable; stack traces and raw driver errors are never returned to the client.

### C7.2 WebSocket event catalogue

Namespace `/`, rooms named `event:<eventId>`. The handshake carries the JWT; unauthenticated sockets may join rooms read-only.

| Direction | Event | Payload | Purpose |
|---|---|---|---|
| Client → Server | `join:event` | `{eventId}` | Subscribe to an event's seat updates |
| Client → Server | `leave:event` | `{eventId}` | Unsubscribe on navigation away |
| Server → Client | `seats:updated` | `{eventId, seatIds[], status}` | Broadcast after a successful booking or cancellation |
| Server → Client | `event:cancelled` | `{eventId}` | Broadcast when an admin cancels an event |
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
| Malformed request body | Validation middleware | 400 listing the offending fields |

**Retry policy:** the client retries idempotent reads (GET) with exponential backoff up to three attempts. Booking creation is **never** retried automatically, since a blind retry could produce a duplicate booking; the user is instead shown the conflict and asked to choose again.

## C8. Traceability — requirements to design

| Requirement | Design element | ADR |
|---|---|---|
| FR-1–4 | Auth middleware, User model | ADR-005 |
| FR-7–12 | Event controller/service, indexes | ADR-002 |
| FR-13–14 | Seat map component, socket gateway | ADR-003 |
| FR-15 | Atomic conditional update in booking service | ADR-004 |
| FR-16 | Client reconnect handler | ADR-003 |
| FR-17–21 | Booking controller/service | ADR-002, ADR-004 |
| FR-22–23 | Venue controller, seat layout derivation | ADR-002 |
| NFR-2 | Indexes, no cache | ADR-006 |
| NFR-6 | Atomic update | ADR-004 |

## C9. Requirements traceability to rubric

| Rubric category | Satisfied by |
|---|---|
| Analysis (10%) | §A2–A5, §C3–C5 (users, benefits, prioritised testable requirements) |
| Design (20%) | §A6 (component diagram, data flow), §C6–C7 (data model, API contract), Part B (ADRs) |
| Software (30%) | FR-1–25 (CRUD ×4, WebSockets, security, distributed) |
| Testing (20%) | Part D (pyramid, coverage targets, four levels, example cases) |
| CI/CD (10%) | §A9, §D7 (pipeline from S0) |
| Evaluation (10%) | O1–O7 success criteria; ADR "revisit when" triggers |

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
| Protocol | Task-based, think-aloud. Tasks: (1) register, (2) find a named artist's concert, (3) book two adjacent seats, (4) find your booking reference, (5) cancel it |
| Measures | Task completion rate, time on task, errors, observed points of confusion, short post-task rating |
| Ethics | Informed consent obtained, purpose explained, right to withdraw, results anonymised, no personal data retained — per University requirements |
| Output | Findings ranked by severity, the modifications made in response, and a re-test of any changed flow |

Recording *what changed as a result* is essential — the rubric's top band explicitly asks for resultant modifications, not merely that testing happened.

### D4.7 Static analysis

- **ESLint** across client (`@typescript-eslint`) and server; zero errors required for the pipeline to pass.
- **TypeScript compiler** (`tsc --noEmit`, strict mode) on the client; type errors fail the build. Compiler strictness is itself a static-analysis metric worth reporting.
- **Metrics captured for the report:** total files and lines, rule violations found and fixed over time, complexity warnings, and the count of type errors resolved during development (evidence the TypeScript investment paid off — useful material for the Evaluation section).

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
| FR-21 simulated payment | — | ✔ | ✔ | ✔ | — |
| FR-22/23 venues | ✔ | ✔ | ✔ | — | — |
| FR-24/25 admin views | ✔ | ✔ | — | — | ✔ |
| NFR-1 latency | — | — | ✔ | — | — |
| NFR-3/4/5 security | ✔ | ✔ | ✔ | — | — |
| NFR-6 integrity | ✔ | ✔ | — | — | — |
| NFR-12 accessibility | — | — | — | ✔ | ✔ |

Every "Must" requirement is covered at two or more levels.

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

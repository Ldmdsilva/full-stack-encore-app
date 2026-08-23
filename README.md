# Encore

A concert ticket booking system: a React/Vite/TypeScript client, a Node.js/Express/MongoDB API, real-time seat availability over Socket.IO, real Stripe payments, and email (nodemailer) + SMS (notify.lk) notifications.

The full requirements, architecture decisions, and test strategy live in [`docs/encore-PID-SRS.md`](docs/encore-PID-SRS.md). This README is the practical setup path — per NFR-8, the stack does not start without configuration, so treat this as mandatory reading before your first run, not optional.

## Contents

- [Prerequisites](#prerequisites)
- [1. Get a database](#1-get-a-database)
- [2. Configure the server](#2-configure-the-server)
- [3. Configure the client](#3-configure-the-client)
- [4. Install dependencies](#4-install-dependencies)
- [5. Seed the database](#5-seed-the-database)
- [6. Forward Stripe webhooks (local development)](#6-forward-stripe-webhooks-local-development)
- [7. Run it](#7-run-it)
- [Docker Compose (containerised alternative)](#docker-compose-containerised-alternative)
- [Troubleshooting](#troubleshooting)
- [Scripts reference](#scripts-reference)

## Prerequisites

- **Node.js 22** (both `client/` and `server/` target Node 22; the server Dockerfile is `node:22-alpine`).
- **A MongoDB connection** — either a free MongoDB Atlas cluster, or the bundled `local-mongo` Docker Compose profile if you don't have Atlas access (see [§1](#1-get-a-database)).
- **Docker + Docker Compose** — optional, only needed for the containerised path.
- **The Stripe CLI** — optional but recommended for local development; needed to receive webhook events without deploying anything publicly. Install from [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli).
- Accounts you'll want in test/sandbox mode: **Stripe** (test-mode publishable + secret key), an **SMTP** provider (or skip — see below), and **notify.lk** (optional — `NotifyDEMO` works for testing).

## 1. Get a database

**Option A — MongoDB Atlas (recommended):**

1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user (username + password) scoped to that cluster.
3. Under Network Access, allow your current IP (or `0.0.0.0/0` for a quick local demo — tighten this before sharing the cluster).
4. Copy the connection string from "Connect → Drivers" — it looks like `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/encore_dev?retryWrites=true&w=majority`.

**Option B — no Atlas access (offline fallback, R11):** run the bundled `local-mongo` Docker Compose profile instead — no Atlas account needed. See [Docker Compose](#docker-compose-containerised-alternative) below. If you're running the server outside Docker but want a local Mongo, start just that service:

```bash
docker compose --profile local-db up local-mongo -d
```

and point `MONGODB_URI` (below) at `mongodb://localhost:27017/encore_dev`.

## 2. Configure the server

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in:

| Variable | Where to get it | Required to boot? |
|---|---|---|
| `MONGODB_URI` | §1 above | **Yes** |
| `JWT_SECRET` | Any long random string (`openssl rand -hex 32`) | **Yes** |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/test/apikeys) (test mode) | **Yes** — booking creation calls Stripe immediately |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | Your provider, or **leave blank** | No — an Ethereal test account is created automatically in development, and its preview URL is logged to the console on every send |
| `NOTIFYLK_USER_ID`, `NOTIFYLK_API_KEY` | [notify.lk](https://notify.lk) account | No — leave blank or set `SMS_ENABLED=false`; SMS sends are logged and skipped, never fail a request |
| `HOLD_TTL_MINUTES` | Default `10` is fine | No |
| everything else | Defaults in `.env.example` are sensible for local dev | No |

## 3. Configure the client

```bash
cp client/.env.example client/.env
```

Fill in `VITE_STRIPE_PUBLISHABLE_KEY` with the **same publishable key** you used for the server (never the secret key — anything in the client bundle is public). `VITE_API_URL` and `VITE_SOCKET_URL` can stay as shipped; the Vite dev server proxies `/api` and `/socket.io` to `localhost:5000` so the browser only ever talks to one origin.

## 4. Install dependencies

```bash
npm install --prefix server
npm install --prefix client
```

## 5. Seed the database

```bash
npm run seed
```

(root `package.json` forwards this to `npm --prefix server run seed`, i.e. `node server/src/scripts/seed.js`). This is idempotent — safe to re-run — and creates:

- **2 venues** (The Half Moon, London; Corn Exchange, Bristol), each with a 108-seat, 3-section layout.
- **6 events** across both venues, LKR-priced.
- **1 admin account** — `admin@encore.live` / `Admin123!`
- **3 customer accounts** — `miriam.osei@example.com`, `theo.blackwell@example.com`, `priya.nair@example.com`, all with password `Password123!`

Use the admin login to reach `/admin`; use any customer login (or register your own, with a real-looking Sri Lankan mobile number) to book.

## 6. Forward Stripe webhooks (local development)

Booking confirmation is **webhook-driven, not client-driven** (ADR-011) — the server only ever marks a booking `confirmed` when it receives an event from Stripe, never as a direct result of the checkout request. Locally, that means Stripe needs somewhere to deliver events to, which your laptop isn't unless you forward them:

```bash
stripe login          # once, opens a browser to link your Stripe account
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Leave this terminal running for the whole session — every payment event flows through it.

> **Note:** this deployment has no `STRIPE_WEBHOOK_SECRET` configured, so incoming webhook payloads are trusted as-is rather than verified against Stripe's signature header. That's fine for local development against your own Stripe test account, but it means the `/api/payments/webhook` endpoint will accept a forged "payment succeeded" event from anyone who can reach it — do not expose it publicly without adding signature verification back.

## 7. Run it

Three terminals:

```bash
# Terminal 1 — API (http://localhost:5000)
npm run dev:server

# Terminal 2 — client (http://localhost:5173)
npm run dev:client

# Terminal 3 — already running from §6
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Open `http://localhost:5173`, log in (or register), pick an event, select seats, and pay with Stripe's universal test card **`4242 4242 4242 4242`**, any future expiry, any CVC, any postcode.

## Docker Compose (containerised alternative)

```bash
docker compose up --build
```

This builds and runs the `server` and `client` services (client served by nginx on `http://localhost:8080`, proxying `/api` and `/socket.io` to the server container). `server/.env` is loaded via `env_file`, so **no secret is duplicated into `docker-compose.yml`** — fill it in exactly as in §2 first.

No Atlas access? Run the bundled local Mongo profile alongside the stack:

```bash
docker compose --profile local-db up --build
```

and set `server/.env`'s `MONGODB_URI` to `mongodb://local-mongo:27017/encore_dev` beforehand.

Webhook forwarding (§6) still applies when running in Docker — point `stripe listen` at `localhost:5000/api/payments/webhook` (the server's exposed port) exactly as above.

## Troubleshooting

**My booking is stuck on "Confirming payment…" / stays `pending` forever, even though Stripe shows the payment succeeded.**
This is almost always a missing webhook delivery. The booking is only confirmed when the server receives a webhook event (ADR-011) — the client's own "payment succeeded" callback is deliberately never trusted for this. Check:
1. Is `stripe listen --forward-to localhost:5000/api/payments/webhook` actually running?
2. Is the server actually receiving the forwarded requests (check its logs)?

It looks like a bug — it isn't. It's the intended failure mode of a webhook-authoritative design with no webhook delivered.

**Seat holds keep expiring while I'm still testing.**
`HOLD_TTL_MINUTES` (default 10) governs how long a `pending` booking's seats stay `held` before the background reaper releases them. Raise it in `server/.env` for a longer testing session, or re-issue a fresh checkout via the event page.

**Email/SMS aren't arriving.**
Expected if you left `SMTP_HOST`/`NOTIFYLK_*` blank — check the server console for an Ethereal preview URL (email) or a `[SMS] Disabled — skipping send` log line. Neither is required to complete a booking; notifications are best-effort by design (ADR-012) and never block or fail a request.

**`docker compose up` can't reach MongoDB.**
Confirm `MONGODB_URI` in `server/.env` is reachable from inside a container — `localhost` inside the `server` container is the container itself, not your host machine. Use `mongodb://local-mongo:27017/...` for the bundled profile, or your Atlas SRV string (which resolves over the internet regardless of container networking).

## Scripts reference

Convenience scripts live in the root `package.json` (deliberately **not** npm workspaces — see its `description` field for why) and simply forward to `npm --prefix`:

| Command | Effect |
|---|---|
| `npm run dev:server` | `server/`'s dev server (`node --watch`) |
| `npm run dev:client` | `client/`'s Vite dev server |
| `npm run seed` | Populate fixture data (§5) |
| `npm test` | Server + client test suites |
| `npm run lint` | ESLint on both sides |
| `npm run typecheck` | `tsc --noEmit` on the client |
| `npm run build` | Production client bundle |

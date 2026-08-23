# Encore — Static Analysis Report

**Companion document to** `docs/encore-cinema-PID-SRS.md` §D4.7 (Static analysis). This is a **point-in-time snapshot**, captured by actually running the project's lint, type-check, test, and line-count tooling at the end of implementation — not an estimate. This supersedes an earlier draft of this document captured mid-implementation, which recorded a non-zero error count against code that was, at that point, still under active concurrent development; every issue that draft identified has since been fixed and is verified clean below.

**How to reproduce this report:**

```bash
npm --prefix server run lint
npm --prefix client run lint
npm --prefix client run typecheck
npm --prefix server run test:coverage
git ls-files server/src server/tests client/src | xargs wc -l
```

---

## 1. Codebase size

| Area | Files | Lines |
|---|---|---|
| `server/src/**/*.js` | 62 | 3,623 |
| `server/tests/**/*.js` | 21 | 3,570 |
| `client/src/**/*.{ts,tsx}` | 98 | 8,480 |
| **Total (application + test code, excluding `node_modules`, `dist`, lockfiles)** | **181** | **15,673** |

Counted with `find <dir> -type f -name '*.ext' | xargs wc -l` scoped to each area.

## 2. ESLint

### 2.1 Server (`npm --prefix server run lint`)

**Result: 0 errors, 0 warnings.**

The one config gap identified during implementation — `server/eslint.config.js`'s `languageOptions.globals` allowlist predated Phase 3's `smsService.js` (which uses Node 22's native `fetch`/`URLSearchParams` deliberately, per ADR-012, to avoid an HTTP client dependency) and the test files that stub `global.fetch` to mock it — has been closed by adding `fetch`, `URLSearchParams`, and `global` to that allowlist. Two unused-import warnings in `tests/unit/emailService.test.js` and `tests/unit/smsService.test.js` were also cleared.

### 2.2 Client (`npm --prefix client run lint`)

**Result: 0 errors, 5 warnings — all `react-refresh/only-export-components`.**

| File | Warnings | Detail |
|---|---|---|
| `client/src/components/ui/toast.tsx` | 1 | Exports both `ToastProvider` (component) and `useToast` (hook) |
| `client/src/context/AuthContext.tsx` | 1 | Exports both `AuthProvider` and `useAuth` |
| `client/src/context/SocketContext.tsx` | 1 | Exports both `SocketProvider` and `useSocket` |
| `client/src/test/utils.tsx` | 2 | Test-only render helper exporting both a wrapper component and helper functions |

These are Vite Fast Refresh advisories, not correctness issues: they flag a file that exports both a component and a non-component value, which is idiomatic React Context/hook code (and, for the last file, idiomatic RTL custom-render-helper code). Treating this as an error would force splitting every context file in two for no functional benefit, so it is accepted as a warning rather than suppressed or "fixed."

**A real finding from the earlier draft, since fixed:** `eslint-plugin-react-hooks` v7's `recommended` config bundles the full **React Compiler** rule suite (`react-hooks/refs`, `react-hooks/use-memo`, `react-hooks/purity`, etc.), which flagged legitimate pre-compiler patterns this project actually uses and does not use the React Compiler with — lazily initialising a ref on first render (`if (!ref.current) ref.current = ...`, `SocketContext.tsx`), and a ref that mirrors current state for a stable-callback closure (`useEventSeats.ts`). `client/eslint.config.js` now enables only the two classic, compiler-independent hooks rules (`rules-of-hooks`, `exhaustive-deps`) rather than the full `recommended` set, which is the correct scope for a codebase not adopting the React Compiler.

## 3. TypeScript (`npm --prefix client run typecheck`, `tsc --noEmit`, strict mode)

**Result: 0 errors.**

The 17 errors recorded in the earlier draft all traced to one of two root causes, both now resolved: (1) the pre-existing Figma Make mock-data files (`lib/mockData.ts`, `lib/adminMockData.ts`) were deleted once nothing imported them (Phase 5, done last as planned); (2) `AdminBookingsPage.tsx`, `AdminDashboard.tsx`, and `AdminEventFormPage.tsx` were updated for the current `Booking`/`Event` contract (`payment`, `holdExpiresAt`, the `pending`/`expired` statuses, `imageUrl` in place of the old mock's `image`). `strict` mode plus `noUnusedLocals`/`noUnusedParameters` (ADR-008 action item 1) caught every one of these at compile time rather than as a runtime bug — direct evidence for the SRS's Evaluation-section claim that the TypeScript investment pays for itself on the client.

## 4. Server test suite (`npm --prefix server run test:coverage`)

**Result: 19 suites, 154 tests, all passing. All coverage thresholds met.**

| Threshold (SRS §D3) | Required | Actual |
|---|---|---|
| Global lines | 70% | 82.4% |
| `src/services/**` lines (per file) | 85% | all ≥ 85% |
| `src/services/bookingService.js` lines | 90% | 100% |
| `src/middleware/auth.js` branches | 100% | 100% |

The concurrency test (`tests/concurrency/booking.concurrency.test.js`, D4.3) asserts the headline guarantee: 50 simultaneous requests for the same seats yield exactly one `201` and forty-nine `409 SEAT_UNAVAILABLE`, exactly one `pending` booking, and seat status `held` — the ADR-004 atomic conditional update, now targeting `held` instead of `booked` per ADR-009, with the guarantee itself unchanged.

## 5. Summary

| Metric | Server | Client |
|---|---|---|
| Files scanned (src) | 62 | 98 |
| Lines (src) | 3,623 | 8,480 |
| ESLint errors | 0 | 0 |
| ESLint warnings | 0 | 5 (Fast Refresh advisories, accepted) |
| `tsc --noEmit` errors | n/a (JavaScript, ADR-008) | 0 |
| Test suites / tests (server) | 19 / 154, all passing | — |

**Honest framing for the report's Evaluation section:** both sides of the codebase are lint-clean (bar five accepted Fast Refresh advisories) and type-clean, and the server's coverage gates — set deliberately non-uniformly (global 70%, services 85%, the concurrency-critical `bookingService.js` at 90%, `middleware/auth.js` at 100% branch) per SRS §D3 — are met everywhere they are enforced.

## 6. Client test suite (`npx vitest run --coverage`)

**Result: 39 suites, 150 tests, all passing. Coverage clears the 60% gate on every metric.**

| Metric | Gate | Actual |
|---|---|---|
| Lines | 60% | 82.59% |
| Statements | 60% | 80.51% |
| Branches | 60% | 77.78% |
| Functions | 60% | 76.21% |

A six-agent audit pass against the plan surfaced and this report's authors then fixed three real, small defects the suite caught: `LoginPage.tsx` and `ProfilePage.tsx` were missing `noValidate` on their `<form>` elements, so native HTML5 constraint validation (from `required`/`type="email"` attributes) silently intercepted `onSubmit` before the pages' own inline-error validators ever ran — a genuine, if narrow, app bug the tests correctly caught, not a test-authoring mistake. Both are fixed. A fourth failure (`EventListPage`'s empty-state test) was a timing flake — its 300ms filter debounce plus refetch occasionally exceeded RTL's default 1000ms `findBy` timeout under full-suite, coverage-instrumented load; given the same 2000ms timeout already used elsewhere in that file resolves it, and it fails only under full-suite load, this was timing headroom, not a functional defect.

## 7. Playwright E2E suite

Six spec files exist under `e2e/` at the repo root, one per SRS §D4.4 journey, enumerating 8 tests via `npx playwright test --list --config=playwright.config.ts`. They type-check cleanly and are structurally verified, but could not be run live in this environment — no real MongoDB or Stripe test-mode credentials are available in this sandbox, and `bookingService.createBooking` genuinely calls the live Stripe API to open a seat hold, so most journeys require both before they can execute. Run this suite for real, on demand and at the next milestone, with real credentials configured.

## 8. Regeneration protocol

**Every metric in §1–§7 above (line counts, lint results, type-check results, coverage percentages, test/suite counts) was captured against the pre-migration, concert-domain codebase.** The cinema-domain migration renames and restructures source files (e.g. `eventService.js` / `venueService.js` and their tests are being replaced by film/cinema/showtime equivalents), which invalidates every number above even where the underlying logic is unchanged. **Do not hand-adjust the old figures.** Once the migration lands, regenerate this entire document from scratch as follows:

1. **Confirm the working tree is the post-migration state** (correct branch, dependencies installed with `npm install` in both `server/` and `client/`).
2. **Lint, from the repo root:**
   ```bash
   npm run lint
   ```
   Transcribe the exact error/warning counts (and any remaining file/rule detail worth keeping, per §2) into §2 for server and client separately — the script runs both (`npm --prefix server run lint && npm --prefix client run lint`).
3. **Type-check, from the repo root:**
   ```bash
   npm run typecheck
   ```
   Record the exact error count into §3 (this only covers the client; the server remains plain JavaScript per ADR-008).
4. **Server tests with coverage, from the repo root:**
   ```bash
   npm run test:server -- --coverage
   ```
   Transcribe the real suite/test counts and the actual coverage percentages against each threshold in `server/package.json`'s `jest.coverageThreshold` into §4.
5. **Client tests with coverage, from the repo root:**
   ```bash
   npm run test:client -- --coverage
   ```
   Transcribe the real suite/test counts and the actual lines/statements/branches/functions percentages into §6. Note any genuine defects the suite catches (as §6 did for the pre-migration run) rather than only the headline numbers.
6. **E2E suite, from the repo root:**
   ```bash
   npm run test:e2e
   ```
   or, to re-enumerate without executing, `npx playwright test --list --config=playwright.config.ts`. Update the spec-file and test counts in §7, and actually run the suite (not just list it) whenever real MongoDB and Stripe test-mode credentials are available — this environment could only verify the suite structurally.
7. **Codebase size:**
   ```bash
   git ls-files server/src server/tests client/src | xargs wc -l
   ```
   Re-scope the `find`/`wc` counts in §1 to whatever the post-migration directory layout actually is (file and folder names will have changed with the domain rename) rather than assuming the old paths still apply.
8. **Rewrite §1–§7 in place** using only the numbers actually produced by the commands above — do not average, estimate, or carry forward any pre-migration figure. If a command's output contradicts a claim elsewhere in this document (e.g. a previously-accepted warning that no longer appears, or a new one that does), update the prose, not just the table.
9. **Update this file's opening paragraph** to record the new capture date and confirm it is again a point-in-time snapshot of a real run, not an estimate.

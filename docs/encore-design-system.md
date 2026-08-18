# Encore — Design System

**Concert ticket booking web app · v1.0**

> A ticket you can almost tear. The system is grounded in the physical artifact of live music — the printed ticket stub — rather than tech-UI conventions. Warm paper, ink, letterpress type, and a perforated tear-line give the app one memorable identity.

---

## 1. Design direction

The generic ticketing app is near-black with a neon accent. Encore deliberately avoids that. Every distinctive choice derives from the printed stub: the paper base, the monospace serial/seat numbers, the letterpress gig-poster titles, and the perforated tear-line that recurs across the event card, the booking confirmation, and the "my tickets" view.

- **Target users:** fans booking seats for live shows; admins managing events.
- **The page's one job:** make choosing a show and picking a seat feel like holding a real ticket.
- **Signature element:** the perforated stub — a dashed tear-line with a barcode panel.

---

## 2. Color palette

| Token | Name | Hex | Role |
|---|---|---|---|
| `--ink` | Ink | `#1A1714` | Primary text, stub background |
| `--stamp-red` | Stamp red | `#C8102E` | Primary actions (Book seats) |
| `--marquee-gold` | Marquee gold | `#E4B04A` | Accents, selected seat |
| `--ticket-paper` | Ticket paper | `#F3EEE3` | Page background, text on ink |
| `--stage-green` | Stage green | `#3A7D6E` | Available seat |
| `--ash` | Ash | `#8A8178` | Muted text, dividers |
| `--seat-taken` | Seat taken | `#B8AFA4` | Unavailable seat |

Colors carry meaning, not decoration. Green = available, gold = your selection, ash = taken.

---

## 3. Typography

Three roles. A serif "voice" face for marquee/event titles (the letterpress gig-poster feel), sans for body and UI, and monospace for all data — seat numbers, serials, prices, and section codes. The mono treatment is what makes `B-14 · #ENC-4471` read like a barcode-printed ticket.

| Role | Family | Size | Weight | Use |
|---|---|---|---|---|
| Marquee | Serif (voice) | 34px | 500 | App name, event titles |
| Event title | Sans | 22px | 500 | Card and section headings |
| Body | Sans | 16px | 400 | Details, descriptions (line-height 1.7) |
| Data | Mono | 13px | 400 | Seat numbers, serials, prices, section codes |

**Rules:** sentence case everywhere; two weights only (400 regular, 500 medium); mono is reserved for machine-readable data.

---

## 4. The ticket stub (signature)

The recurring hero element. An ink panel split by a dashed vertical tear-line, with a barcode + serial panel on the right.

**Anatomy:**
- **Left (detail) panel** — gold eyebrow (date/time in mono), serif event title, venue in ash, then a mono row of `SECTION / SEAT / PRICE`.
- **Tear-line** — `2px dashed` divider in a mid-ash tone (`#55504A` on ink).
- **Right (stub) panel** — vertical barcode bars in paper on ink, with the mono serial (`ENC-4471`) beneath.

Reused across: the event card, the booking confirmation, and the "my tickets" list.

---

## 5. Buttons

| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| Primary | `--stamp-red` | `--ticket-paper` | none | Book seats |
| Secondary | transparent | `--text-primary` | `0.5px` strong | View details |
| Disabled | transparent | `--ash` | `0.5px` hairline | Sold out |

Radius `--radius` (8px), padding `10px 20px`, size 14px / weight 500. One primary action per view.

---

## 6. Form fields

Labels sit above the control: 13px, secondary color, 6px gap. Inputs and selects are full-width within their grid cell, 36px tall, with hairline borders and built-in hover/focus rings. Placeholders show a real example of valid input (`name@email.com`), never the label repeated.

---

## 7. Seat map (live availability)

A `STAGE` bar (ink background, gold label) sits above a grid of seats. Each seat is a rounded square colored by state:

- **Available** — `--stage-green`, pointer cursor.
- **Selected** — `--marquee-gold`.
- **Taken** — `--seat-taken`, not-allowed cursor.

A legend below maps each color. Seat state is driven live by WebSocket `seatUpdate` events — when another client books a seat, it animates from green to ash in real time.

---

## 8. Status badges

Pill-shaped (`border-radius: 999px`), 12px / weight 500, tint background with a darker same-family text color.

| Status | Background | Text |
|---|---|---|
| Confirmed | `#E1F5EE` | `#0F6E56` |
| Pending | `#FAEEDA` | `#854F0B` |
| Cancelled | `#FCEBEB` | `#A32D2D` |
| Few left | `#F1EFE8` | `#444441` |

---

## 9. Layout tokens

| Token | Value |
|---|---|
| Card radius | `12px` |
| Control radius | `--radius` (8px) |
| Card border | `0.5px solid` hairline |
| Card padding | `1rem 1.25rem` |
| Vertical rhythm | `1rem` / `1.5rem` / `2rem` |
| Component gaps | `8px` / `12px` / `16px` |

---

## 10. CSS custom properties

Drop into `client/src/index.css` as the single source of truth (this is the DRY example for the report — every component derives its colors and radii from here).

```css
:root {
  --ink: #1A1714;
  --stamp-red: #C8102E;
  --marquee-gold: #E4B04A;
  --ticket-paper: #F3EEE3;
  --stage-green: #3A7D6E;
  --ash: #8A8178;
  --seat-taken: #B8AFA4;
  --radius: 8px;

  --font-voice: Georgia, "Times New Roman", serif;
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: "SF Mono", "Roboto Mono", monospace;
}
```

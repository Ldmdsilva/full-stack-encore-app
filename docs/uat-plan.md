# Encore — User Acceptance Testing (UAT) Plan

**Companion document to** `docs/encore-PID-SRS.md` §D4.6 (Usability testing). This plan operationalises that section's protocol — participants, tasks, ethics, and measures — into a runnable session script, and adds the findings-and-resultant-modifications record the rubric's top band asks for. It is written to be run as-is; where no session has yet taken place, that is stated explicitly rather than implied.

**Status: template, ready for use.** The findings table in §6 contains placeholder rows only — no UAT session had been conducted at the time this document was written. Facilitators should run the sessions in §3, then replace §6 with the real results and re-test any flow that changed.

---

## 1. Purpose and scope

Confirm that a first-time user can complete the core booking journey — including the real Stripe payment and seat-hold flow introduced in the v2.3 SRS amendment (ADR-009, ADR-010) — without external help, and surface points of confusion severe enough to warrant a design change before submission. This is a small, qualitative, task-based study, not a statistically powered usability study; it targets the SRS's stated minimum of 3 participants (target 5).

## 2. Participants

| Aspect | Plan |
|---|---|
| Target | 5 participants; minimum 3 (the SRS's stated point of diminishing returns for this scale of study) |
| Recruitment | Peers or coursemates unfamiliar with Encore's implementation; a mix of at least one participant unfamiliar with concert-ticketing sites generally, to avoid testing only "expert" assumptions |
| Compensation | None required; participation is voluntary |
| Equipment | Participant's own laptop/desktop with a modern browser, or a facilitator-provided machine; the Encore client running against a seeded, Stripe-test-mode backend (never production data or a live card) |
| Duration | ~20–25 minutes per session: 2 min intro/consent, ~15 min tasks, ~5 min debrief/rating |

## 3. Protocol

**Format:** one participant at a time, task-based, **think-aloud** (the participant narrates what they're looking at, expecting, and trying, continuously, while the facilitator observes and takes notes without helping unless the participant is fully stuck for >60 seconds — noted as a task failure if so).

**Facilitator script (read or paraphrase to the participant before starting):**

> "Thanks for helping test Encore, a concert ticket booking site. I'm going to ask you to complete a few tasks as if you were a real customer. There are no wrong answers — if something is confusing, that's useful information, not a mistake on your part. Please talk through what you're thinking as you go: what you expect to happen, what you're looking for, anything that surprises you. I won't be able to help unless you're completely stuck, so try to work through anything ambiguous the way you would on a real site. This should take about 20 minutes. You can stop at any time for any reason."

**Before starting**, obtain informed consent (§4). **After the last task**, run the short debrief and rating (§5).

**Test data:** each participant registers their own account during Task 1 rather than reusing a seeded account, so registration itself is genuinely tested. The environment runs against Stripe **test mode only** — Stripe's universal test card `4242 4242 4242 4242` (any future expiry, any CVC, any postcode) is provided to the participant on an index card for Task 3; no real payment method is ever requested or accepted.

### The five tasks

Chosen to exercise the full real booking pipeline now in place — registration through to a genuine hold → pay → confirm cycle and a cancellation/refund — rather than only the parts of the flow that were already working before the v2.3 changes.

| # | Task (as read to the participant) | What it exercises | Success criterion |
|---|---|---|---|
| 1 | "Create an account for yourself, using a real-looking mobile number." | FR-1 registration, phone validation/normalisation (required since v2.3) | Account created, redirected into the app signed in, without external help |
| 2 | "Find a concert you like the look of, and narrow the list down using the filters until you're looking at just that one." | FR-7/FR-9 browse, search/filter (genre, artist, date, venue) | Participant reaches the target event's detail page using at least one filter, unprompted |
| 3 | "Pick two seats next to each other and complete the booking, including payment." | FR-13 seat map, FR-17 booking creation, FR-21/FR-26 real Stripe payment against a time-limited hold | Participant selects seats, reaches checkout, enters the supplied test card into the Payment Element, and reaches a confirmation screen without being told what to do |
| 4 | "Without me telling you where to look, find the booking reference for what you just booked." | FR-18/FR-20 booking history and confirmation detail | Participant locates the reference (on the confirmation page or in "My Bookings") within a reasonable number of navigation attempts |
| 5 | "You've changed your mind — cancel that booking, and tell me what you expect to happen to the money you paid." | FR-19/FR-29 cancellation and refund | Participant locates and completes cancellation, and can correctly describe (in their own words) that a refund follows, based on what the UI told them |

## 4. Ethics and consent

Usability testing follows University ethical guidelines for low-risk studies involving informed adult participants: informed consent, the right to withdraw at any time without giving a reason, and anonymised, minimal-retention results. No real payment details, real financial data, or personally sensitive information is collected — participants use a facilitator-supplied test card and are encouraged to register with a fictional or throwaway name and email if preferred.

**Consent statement, read or handed to the participant before the session begins:**

> **Encore usability study — informed consent**
>
> You are being invited to take part in a short usability study of Encore, a concert ticket booking website built as part of a university coursework project. Taking part is entirely voluntary.
>
> If you agree to take part, you will be asked to complete a small number of realistic tasks on the website (such as registering an account, finding an event, and booking a ticket) while thinking aloud about what you are doing. The session will take about 20 minutes. A researcher will take written notes on where you succeed, where you hesitate, and any comments you make; no video or audio recording is made, and no payment card details of any kind (real or fictional) are recorded — a test card number is provided for you to use, and it processes no real transaction.
>
> Your name will not be attached to any notes or the final report; you will be referred to only as "Participant 1," "Participant 2," and so on. Findings will be reported only in aggregate or anonymised form as part of the coursework submission.
>
> You may stop the session at any time, for any reason, without needing to explain why, and any notes taken about your session will be discarded if you withdraw. Taking part or not taking part will have no effect on you in any way.
>
> If you are happy to proceed on this basis, please say so verbally or sign below.
>
> Participant signature / verbal confirmation: ______________________  Date: __________

## 5. Measures

Recorded per participant, per task:

- **Task completion:** completed unaided / completed with a hint / not completed within a reasonable time.
- **Time on task:** approximate, from the facilitator reading the task aloud to the participant indicating they believe they're done.
- **Errors:** any action that does not move the participant toward the goal (e.g. clicking a non-interactive element, navigating to the wrong page, re-entering a form field).
- **Observed points of confusion:** noted verbatim where possible (what the participant said or asked), not just categorised.
- **Post-task rating:** a 1–5 rating ("How easy or difficult was that?", 1 = very difficult, 5 = very easy") immediately after each task, before moving to the next — this captures subjective friction that completion alone misses.

At the end of the session, ask one open question: *"Was there anything at any point where the site did something you didn't expect?"* — this is where hold-expiry, payment confirmation delay (the webhook round-trip, ADR-011), and refund-timing confusion are most likely to surface, since all three are genuinely asynchronous behaviours a first-time user has no reason to anticipate.

## 6. Findings and resultant modifications

**No sessions had been run at the time this document was written.** The table below is a template with the correct columns for recording real results — copy it once per completed round of testing (a "round" being all planned participants for that pass) and fill it in from session notes. Do not report this table as containing real findings until real sessions have populated it.

| # | Round | Task | Participant(s) affected | Observation (severity: Critical / Major / Minor / Cosmetic) | Resultant modification | Re-tested? |
|---|---|---|---|---|---|---|
| 1 | *(e.g. Round 1)* | *(e.g. Task 3 — payment)* | *(e.g. P2, P4)* | *(placeholder — e.g. "Participant did not realise the seat-hold countdown meant their seats would be released; assumed the timer was just decorative.")* | *(placeholder — e.g. "Added an explicit warning label and colour change to the countdown at <2 minutes remaining.")* | *(Yes/No — and with which participant(s))* |
| 2 | | | | | | |
| 3 | | | | | | |

**Severity scale (for consistency across rounds):**

- **Critical** — the participant could not complete the task at all, even with the full timeout allowed.
- **Major** — the participant completed the task, but only after a wrong turn that cost significant time or a moment of visible frustration/hesitation.
- **Minor** — a comment or brief hesitation with no material effect on completion.
- **Cosmetic** — a stylistic observation with no functional effect.

**Process:** after each round, triage findings by severity, decide which warrant a change given remaining time, make the change, and — for anything rated Critical or Major — re-run just that task with a fresh participant (or the same one, if appropriate) to confirm the fix actually resolves the confusion rather than introducing a new one. Recording *what changed as a result* of testing, not merely that testing happened, is the explicit rubric expectation this section satisfies (SRS §D4.6).

## 7. Known limitations of this plan

- A sample of 3–5 is exploratory, not statistically representative; findings indicate plausible usability issues, not proven prevalence.
- All sessions run against Stripe test mode; a participant's comments about payment "trustworthiness" reflect the UI, not real transaction risk.
- The asynchronous webhook-confirmation delay (ADR-011) depends on local network conditions during a facilitator-hosted session (e.g. `stripe listen` running on the same machine) and may not perfectly represent production latency.

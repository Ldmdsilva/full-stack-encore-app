import { test, expect } from '@playwright/test';
import { loginAs } from './utils/auth';
import { seatButton, firstAvailableSeat, seatIdFromLocator } from './utils/seats';
import { isStripeConfigured, SEEDED_CUSTOMERS } from './utils/env';

/**
 * SRS §D4.4 journey 2 — the "marquee test": a booking in browser context A
 * greys the seat out in browser context B within ~1s, with no refresh in B.
 *
 * Important architectural fact this test relies on (read from the actual
 * source, not assumed): selecting a seat in the UI is purely local React
 * state (client/src/hooks/useEventSeats.ts's TOGGLE_SELECT) — nothing is
 * broadcast until a booking is actually created. The server only flips a
 * seat to `held` and calls `broadcastSeatUpdate` inside
 * bookingService.createBooking, AFTER it has opened a real Stripe Checkout
 * Session. So this test — like the payment journey — needs real Stripe
 * TEST-mode keys to produce any observable realtime event at all; there is
 * no server-side "hold" trigger that doesn't go through Stripe.
 */
test('a seat held in one browser context greys out in another within ~2s, no reload', async ({ browser }) => {
  test.skip(
    !isStripeConfigured(),
    'Placeholder Stripe keys in server/.env and client/.env: the only server-side trigger for ' +
      'a `held` seats:updated broadcast is a successful booking creation, which calls the real ' +
      'Stripe API (bookingService.createBooking). Without real TEST-mode keys no seat ever ' +
      'actually becomes `held`, so there is nothing genuine to observe propagate.',
  );

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    // Context A: a signed-in customer about to book.
    await loginAs(pageA, SEEDED_CUSTOMERS[0].email, SEEDED_CUSTOMERS[0].password);
    await pageA.goto('/events');
    await pageA.getByRole('button', { name: /^View / }).first().click();
    await expect(pageA).toHaveURL(/\/events\/[^/]+$/);
    const eventUrl = pageA.url();

    // Context B: any viewer (no login needed to watch the seat map) looking
    // at the exact same event, at the same time.
    await pageB.goto(eventUrl);
    await expect(pageB.getByRole('group', { name: 'Seat selection map' })).toBeVisible();

    const seatOnA = firstAvailableSeat(pageA);
    await expect(seatOnA).toBeVisible();
    const seatId = await seatIdFromLocator(seatOnA);
    const seatOnB = seatButton(pageB, seatId);
    await expect(seatOnB).toHaveAttribute('aria-label', new RegExp(`, available$`));

    // Both sides join the same Socket.IO `event:<id>` room on mount (see
    // useEventSeats.ts's join:event effect) — B never reloads from here on.
    await seatOnA.click();
    await pageA.getByRole('button', { name: 'Continue to checkout' }).click();
    await expect(pageA).toHaveURL(/\/checkout\/[^/]+$/);
    await pageA.getByRole('button', { name: /^Continue to pay/ }).click();
    await expect(pageA.getByText(/^Booking ENC-/)).toBeVisible();

    // Config sets a 5s default expect timeout; the plan calls for tolerating
    // up to ~1-2s for this propagation, not instant, so this is generous
    // relative to the ~1s target while still catching a genuine regression.
    await expect(seatOnB).toHaveAttribute('aria-label', /on hold by another customer/, { timeout: 2_000 });
    await expect(seatOnB).toBeDisabled();

    // Confirm B's local selection state (had it selected the same seat)
    // would also have been dropped — REMOTE_UPDATE in useEventSeats.ts
    // deselects any seat that a remote update marks non-available.
    await expect(seatOnB).toHaveAttribute('aria-pressed', 'false');
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

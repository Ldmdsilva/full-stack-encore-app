import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './utils/auth';
import { firstAvailableSeat, seatButton, seatIdFromLocator } from './utils/seats';
import { isStripeConfigured, isWebhookForwardingAvailable, SEEDED_CUSTOMERS } from './utils/env';

/**
 * SRS §D4.4 journey 4: cancellation round-trip with refund.
 *
 * Two tests, gated at different levels of what's actually achievable
 * without live Stripe infrastructure in this environment:
 *   - "pending" cancellation only needs a successful booking creation
 *     (real Stripe TEST keys to open the Checkout Session), so it's gated
 *     on `isStripeConfigured()` alone. Cancelling a `pending` booking never
 *     calls Stripe's refund API (server/src/services/bookingService.js's
 *     `cancelBooking` only refunds when `wasConfirmed`), so this verifies
 *     the seat-release half of the round trip.
 *   - "confirmed" cancellation needs a booking that actually reached
 *     `confirmed`, which needs the full webhook leg — gated additionally on
 *     `isWebhookForwardingAvailable()`. This is the one that verifies an
 *     actual refund.
 *
 * Neither test fakes a webhook call to force a `confirmed` status — see the
 * payment journey spec for why.
 */

async function selectSeatAndCreatePendingBooking(page: Page) {
  await page.goto('/events');
  await page.getByRole('button', { name: /^View / }).first().click();
  await expect(page).toHaveURL(/\/events\/[^/]+$/);
  const eventUrl = page.url();

  const seat = firstAvailableSeat(page);
  await expect(seat).toBeVisible();
  const seatId = await seatIdFromLocator(seat);
  await seat.click();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page).toHaveURL(/\/checkout\/[^/]+$/);
  await page.getByRole('button', { name: /^Continue to pay/ }).click();

  const bookingText = page.getByText(/^Booking ENC-/);
  await expect(bookingText).toBeVisible();
  const reference = (await bookingText.textContent())!.match(/ENC-[A-Z0-9-]+/)![0];

  return { eventUrl, seatId, reference };
}

async function cancelBookingByReference(page: Page, reference: string) {
  await page.goto('/bookings');
  const row = page.locator('li', { hasText: reference });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Cancel booking' }).click();
  await page.getByRole('button', { name: 'Yes, cancel' }).click();
  await expect(page.getByText('Booking cancelled.')).toBeVisible();
  await expect(row.getByText('Cancelled', { exact: true })).toBeVisible();
  return row;
}

test('cancelling a pending (unpaid) booking releases its seat back to available', async ({ page }) => {
  test.skip(
    !isStripeConfigured(),
    'Booking creation needs real Stripe TEST-mode keys (see the register-browse-book-pay-confirm ' +
      'spec) — without them there is no pending booking to cancel.',
  );

  await loginAs(page, SEEDED_CUSTOMERS[1].email, SEEDED_CUSTOMERS[1].password);
  const { eventUrl, seatId, reference } = await selectSeatAndCreatePendingBooking(page);

  const row = page.locator('li', { hasText: reference });
  await expect(row.getByText('Awaiting payment')).toBeVisible();

  await cancelBookingByReference(page, reference);

  // Round trip: the seat this booking held is available again, observed on
  // a fresh navigation back to the event (not claiming realtime here — that
  // is the dedicated realtime-seat-propagation spec's job).
  await page.goto(eventUrl);
  await expect(seatButton(page, seatId)).toHaveAttribute('aria-label', /, available$/);
});

test('cancelling a confirmed (paid) booking issues a refund and releases its seat', async ({ page }) => {
  test.skip(
    !isStripeConfigured() || !isWebhookForwardingAvailable(),
    'Requires real Stripe TEST-mode keys AND a `stripe listen --forward-to ' +
      'localhost:5000/api/payments/webhook` process running locally (set ' +
      'E2E_STRIPE_WEBHOOK_FORWARDING=1 once it is) — a genuine refund can only be checked ' +
      'against a booking that actually reached `confirmed` via a real webhook, which this test ' +
      'deliberately does not fake.',
  );

  await loginAs(page, SEEDED_CUSTOMERS[2].email, SEEDED_CUSTOMERS[2].password);
  const { eventUrl, seatId } = await selectSeatAndCreatePendingBooking(page);

  const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
  await expect(stripeFrame.locator('body')).toBeVisible({ timeout: 15_000 });
  await stripeFrame.getByPlaceholder('Card number').fill('4242424242424242');
  await stripeFrame.getByPlaceholder('MM / YY').fill('12/34');
  await stripeFrame.getByPlaceholder('CVC').fill('123');
  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page).toHaveURL(/\/confirmation\/([^/]+)$/, { timeout: 20_000 });
  const bookingId = page.url().match(/\/confirmation\/([^/]+)$/)![1];
  await expect(page.getByRole('heading', { name: "You're going." })).toBeVisible({ timeout: 35_000 });
  const reference = (await page.getByText(/^Booking ENC-/).textContent())!.match(/ENC-[A-Z0-9-]+/)![0];

  await cancelBookingByReference(page, reference);

  // The cancel confirmation modal / badge don't surface the refund id in
  // the UI at all, so check the authoritative source: the booking API
  // response itself, authenticated the same way the app's own axios client
  // does (Bearer token from localStorage — see client/src/lib/tokenStore.ts).
  const token = await page.evaluate(() => localStorage.getItem('encore_token'));
  const apiResponse = await page.request.get(`/api/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(apiResponse.ok()).toBe(true);
  const { booking } = await apiResponse.json();
  expect(booking.status).toBe('cancelled');
  expect(booking.payment?.refundId).toBeTruthy();

  await page.goto(eventUrl);
  await expect(seatButton(page, seatId)).toHaveAttribute('aria-label', /, available$/);
});

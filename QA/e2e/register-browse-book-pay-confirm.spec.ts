import { test, expect } from '@playwright/test';
import { registerAs, buildNewCustomer } from './utils/auth';
import { firstAvailableSeat, seatIdFromLocator } from './utils/seats';
import { isStripeConfigured, isWebhookForwardingAvailable } from './utils/env';

/**
 * SRS §D4.4 journey 1: register -> browse -> book -> pay -> confirm.
 *
 * Booking creation itself opens a real Stripe Checkout Session server-side
 * (server/src/services/bookingService.js calls createCheckoutSession before
 * it ever broadcasts the seat hold), so everything from "Continue to pay"
 * onward needs real Stripe TEST-mode keys in server/.env + client/.env —
 * not just the final webhook confirmation. This test always exercises
 * register/browse/select-seats for real, then degrades gracefully:
 *   - no real Stripe keys  -> stops after asserting the checkout page is
 *     reachable with the selected seats, skips the rest with a reason.
 *   - real keys, no `stripe listen` forwarder -> creates the booking for
 *     real (asserts `pending` + a clientSecret + the Payment Element
 *     renders), then stops WITHOUT submitting a card, since without a
 *     webhook there is no way to reach `confirmed` and no point opening a
 *     PaymentIntent we can't resolve.
 *   - real keys + E2E_STRIPE_WEBHOOK_FORWARDING=1 (a `stripe listen`
 *     process is actually forwarding to localhost:5000) -> pays with
 *     Stripe's 4242 test card and asserts the booking reaches `confirmed`.
 */
test('register, browse, select seats, and reach checkout', async ({ page }) => {
  const customer = buildNewCustomer();
  await registerAs(page, customer);

  // Browse: the event list renders real seeded events (server/src/scripts/seed.js).
  await page.goto('/events');
  const firstEventCard = page.getByRole('button', { name: /^View / }).first();
  await expect(firstEventCard).toBeVisible();
  const eventLabel = await firstEventCard.getAttribute('aria-label');
  await firstEventCard.click();

  await expect(page).toHaveURL(/\/events\/[^/]+$/);
  await expect(page.getByRole('group', { name: 'Seat selection map' })).toBeVisible();

  // Book: select one available seat and proceed.
  const seat = firstAvailableSeat(page);
  await expect(seat).toBeVisible();
  const seatId = await seatIdFromLocator(seat);
  await seat.click();
  await expect(seat).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page).toHaveURL(/\/checkout\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByText(seatId, { exact: false }).first()).toBeVisible();

  test.skip(
    !isStripeConfigured(),
    'server/.env and client/.env still carry placeholder Stripe keys in this environment — ' +
      `booking creation (seat "${seatId}" on "${eventLabel}") calls the real Stripe API and ` +
      'cannot proceed without real TEST-mode keys from https://dashboard.stripe.com/test/apikeys.',
  );

  // Pay: creates the booking (atomic seat hold + Stripe Checkout Session).
  const payButton = page.getByRole('button', { name: /^Continue to pay/ });
  await payButton.click();

  await expect(page.getByText(/^Booking ENC-/)).toBeVisible();
  await expect(page.getByText('awaiting payment')).toBeVisible();

  // The Payment Element mounts inside Stripe's own iframe. Stripe.js names
  // Payment Element frames `__privateStripeFrame*` — this is documented
  // Stripe.js behaviour, not something this app controls, but it was not
  // possible to confirm empirically in this sandbox (no real Stripe keys
  // to actually render the element against).
  const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
  await expect(stripeFrame.locator('body')).toBeVisible({ timeout: 15_000 });

  test.skip(
    !isWebhookForwardingAvailable(),
    'Booking reached `pending` with a live clientSecret and the Payment Element rendered — ' +
      'that is as far as this journey can go without a `stripe listen --forward-to ' +
      'localhost:5000/api/payments/webhook` process running locally. Confirmation is ' +
      'webhook-driven (server/src/services/paymentService.js) and is deliberately never ' +
      'faked from inside this test. Set E2E_STRIPE_WEBHOOK_FORWARDING=1 once that forwarder ' +
      'is running to exercise the final pending -> confirmed leg.',
  );

  // From here on a real webhook forwarder is assumed to be running, so it's
  // safe to actually submit a test-mode card and wait for the webhook to
  // land.
  const cardNumberField = stripeFrame.getByPlaceholder('Card number');
  await cardNumberField.fill('4242424242424242');
  await stripeFrame.getByPlaceholder('MM / YY').fill('12/34');
  await stripeFrame.getByPlaceholder('CVC').fill('123');
  const postalField = stripeFrame.getByPlaceholder('ZIP').or(stripeFrame.getByPlaceholder('Postal code'));
  if (await postalField.count()) {
    await postalField.first().fill('10100');
  }

  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page).toHaveURL(/\/confirmation\/[^/]+$/, { timeout: 20_000 });
  // Confirmation is webhook-driven and ConfirmationPage polls for up to 30s
  // (POLL_TIMEOUT_MS in client/src/pages/ConfirmationPage.tsx) while also
  // listening for the `booking:updated` socket event — give it that long.
  await expect(page.getByRole('heading', { name: "You're going." })).toBeVisible({ timeout: 35_000 });
  await expect(page.getByText(seatId, { exact: false }).first()).toBeVisible();
});

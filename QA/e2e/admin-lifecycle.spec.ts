import { test, expect } from '@playwright/test';
import { loginAs } from './utils/auth';
import { SEEDED_ADMIN } from './utils/env';

/**
 * SRS §D4.4 journey 3: admin lifecycle — venue -> event -> public listing ->
 * cancel. Uses the "Cancel event" toggle on AdminEventsPage (a PATCH
 * `{status: 'cancelled'}` per client/src/pages/admin/AdminEventsPage.tsx's
 * `toggleStatus`), which is the everyday admin action for taking a show off
 * sale — distinct from the destructive "Delete event" action, which
 * additionally refunds confirmed bookings server-side
 * (server/src/services/eventService.js's `deleteEvent`). The public event
 * list only ever returns `status: 'scheduled'` events
 * (server/src/services/eventService.js's `getEvents` filter), so cancelling
 * is expected to make the event disappear from /events immediately.
 */
test('create a venue, create an event on it, see it listed, then cancel it', async ({ page }) => {
  const unique = Date.now();
  const venueName = `E2E Test Hall ${unique}`;
  const venueCity = 'Testville';
  const eventTitle = `E2E Test Show ${unique}`;
  const eventArtist = `E2E Test Artist ${unique}`;

  await loginAs(page, SEEDED_ADMIN.email, SEEDED_ADMIN.password);

  // --- Venue ---
  await page.goto('/admin/venues/new');
  await page.getByLabel('Venue name').fill(venueName);
  await page.getByLabel('City').fill(venueCity);
  await page.getByLabel('Full address').fill('1 Test Street');
  // Default seat sections (STALLS/CIRCLE/BALCONY, 108 seats total) are
  // valid as-is — well under the 500-seat cap (ADR-002) — so no need to
  // edit them for this journey.
  await page.getByRole('button', { name: 'Create venue' }).click();

  await expect(page).toHaveURL(/\/admin\/venues$/);
  await expect(page.getByText(venueName)).toBeVisible();

  // --- Event, on that venue ---
  await page.goto('/admin/events/new');
  await page.getByLabel('Show title').fill(eventTitle);
  await page.getByLabel('Artist / act').fill(eventArtist);
  await page.getByLabel('Genre').fill('Test-genre');
  await page.getByLabel('Description').fill('An E2E-created event for the admin lifecycle journey.');

  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 120); // 120 days out
  const localDatetime = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T20:00`;
  // AdminEventFormPage.tsx literally sets label="Date &amp; time" as a raw
  // JS string (not JSX text), so React renders it as literal text — the
  // "&amp;" is not HTML-entity-decoded since it's inserted as a text node,
  // not parsed as markup. Matching the real rendered label, not "Date & time".
  await page.getByLabel('Date &amp; time').fill(localDatetime);

  await page.getByLabel('Venue').selectOption({ label: `${venueName}, ${venueCity}` });
  await page.getByLabel('Base price (LKR)').fill('5000');
  await page.getByRole('button', { name: 'Create event' }).click();

  await expect(page).toHaveURL(/\/admin\/events$/);
  const adminRow = page.locator('tr', { hasText: eventTitle });
  await expect(adminRow).toBeVisible();
  await expect(adminRow.getByText('scheduled', { exact: true })).toBeVisible();

  // --- Public listing ---
  await page.goto('/events');
  await page.getByLabel('Search').fill(eventArtist);
  await expect(page).toHaveURL(/q=/); // debounced search lands in the URL
  await expect(page.getByRole('button', { name: new RegExp(`^View ${escapeRegExp(eventTitle)} `) })).toBeVisible();

  // --- Cancel ---
  await page.goto('/admin/events');
  const rowToCancel = page.locator('tr', { hasText: eventTitle });
  await rowToCancel.getByRole('button', { name: 'Cancel event' }).click();
  await expect(rowToCancel.getByText('cancelled', { exact: true })).toBeVisible();

  // A cancelled event drops out of the public (status: 'scheduled' only) listing.
  await page.goto('/events');
  await page.getByLabel('Search').fill(eventArtist);
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole('button', { name: new RegExp(`^View ${escapeRegExp(eventTitle)} `) })).toHaveCount(0);
  await expect(page.getByText('No concerts match your search')).toBeVisible();
});

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

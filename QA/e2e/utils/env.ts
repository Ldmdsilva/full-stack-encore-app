import fs from 'node:fs';
import path from 'node:path';

/**
 * Minimal `.env` line parser (`KEY=value`, `#` comments, blank lines) — good
 * enough for the flat files this repo uses. Avoids adding a `dotenv`
 * dependency to the root package just for two boolean checks in tests.
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;

  const contents = fs.readFileSync(filePath, 'utf-8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    result[key] = value;
  }
  return result;
}

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const serverEnv = parseEnvFile(path.join(REPO_ROOT, 'server', '.env'));
const clientEnv = parseEnvFile(path.join(REPO_ROOT, 'client', '.env'));

/**
 * True only once server/.env and client/.env carry what look like real
 * Stripe TEST-mode keys rather than the `sk_test_your_stripe_secret_key`
 * placeholders shipped in .env.example. Booking creation itself calls the
 * real Stripe API to open a Checkout Session (see
 * server/src/services/bookingService.js), so *nothing* past "select seats"
 * in the booking journey works without this — not just the final webhook
 * confirmation.
 */
export function isStripeConfigured(): boolean {
  const secret = serverEnv.STRIPE_SECRET_KEY ?? '';
  const publishable = clientEnv.VITE_STRIPE_PUBLISHABLE_KEY ?? '';
  const looksReal = (v: string, prefix: string) => v.startsWith(prefix) && !v.includes('your_stripe');
  return looksReal(secret, 'sk_test_') && looksReal(publishable, 'pk_test_');
}

/**
 * True when the developer running the suite has told us a `stripe listen`
 * process is actively forwarding webhooks to the local server. There is no
 * reliable way to detect this automatically from inside a test, so it's an
 * opt-in env var rather than inferred — see the plan's note that a fully
 * automated "pay" step in a CI-less local run needs either a running
 * forwarder or a tolerant test.
 */
export function isWebhookForwardingAvailable(): boolean {
  return process.env.E2E_STRIPE_WEBHOOK_FORWARDING === '1';
}

export const SEEDED_ADMIN = { email: 'admin@encore.live', password: 'Admin123!' };
export const SEEDED_CUSTOMERS = [
  { email: 'miriam.osei@example.com', password: 'Password123!' },
  { email: 'theo.blackwell@example.com', password: 'Password123!' },
  { email: 'priya.nair@example.com', password: 'Password123!' },
];

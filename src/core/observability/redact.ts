/**
 * Strips credentials out of log context before any transport sees it.
 *
 * This is a safety net, not a licence. The rule in
 * [CONTRIBUTING.md](../../../docs/CONTRIBUTING.md) still stands: do not put a secret in a
 * log call. A denylist only knows the names it was told about, so the first field called
 * `walletSeed` will sail straight through. What it does buy is protection against the
 * realistic accident — logging a whole response, session or form object because it was
 * convenient — which is how tokens actually end up in a log aggregator.
 *
 * Two mechanisms, because keys alone are not enough:
 *
 *   by key    `{ accessToken: '…' }`  → the name says what it is
 *   by shape  `{ data: 'eyJhbGci…' }` → the name says nothing, the value is a JWT
 *
 * The second is what catches a token nested inside a field nobody thought to name.
 */

export const REDACTED = '[redacted]';

/**
 * Matched as substrings of the normalised key, so `access_token`, `accessToken`,
 * `ACCESS-TOKEN` and `x-access-token` are all one entry. Everything here is a word long
 * enough that a substring match will not hit an innocent field.
 *
 * `refresh` is deliberately absent: `refresh_token` is already caught by `token`, while
 * `refresh` on its own would redact `refreshedAt` and `isRefreshing` and make the query
 * layer's own logs unreadable. Prefer the narrower fragment that still covers the secret.
 */
const SENSITIVE_FRAGMENTS = [
  'password',
  'passwd',
  'passphrase',
  'secret',
  'token',
  'credential',
  'authorization',
  'authorisation',
  'cookie',
  'apikey',
  'privatekey',
  'accesskey',
  'sessionid',
  'bearer',
  'signature',
  'otp',
  'onetimecode',
  'verificationcode',
  'securityanswer',
  'cardnumber',
  'creditcard',
  'servicerole',
] as const;

/**
 * Short names that would produce false positives as substrings — `pin` matches `pinned`
 * and `spinner`, `cvv` is fine but belongs with its neighbours. Compared for equality.
 */
const SENSITIVE_EXACT = ['pin', 'cvv', 'cvc', 'ssn', 'iban', 'auth', 'jwt', 'key', 'dob'] as const;

/**
 * A JWT: three base64url segments, the first of which starts `eyJ` because a JOSE header
 * begins `{"`. Specific enough that a false positive is close to impossible, which matters
 * — over-redaction quietly destroys the debuggability the logger exists for.
 */
const JWT_PATTERN = /^eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*$/;

/** Supabase's newer key format. Publishable keys are public, but logging one is still noise. */
const SUPABASE_KEY_PATTERN = /^sb_(secret|publishable)_[A-Za-z0-9_-]+$/;

/** `Authorization: Bearer …` copied into a context object as a single string. */
const BEARER_PATTERN = /^bearer\s+\S+$/i;

/**
 * Deep enough for a nested API response, shallow enough that a pathological structure
 * cannot stall the UI thread inside a log call.
 */
const MAX_DEPTH = 6;

/** A log line is for diagnosis, not for data transfer. Long arrays get truncated. */
const MAX_ARRAY_ITEMS = 20;

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[\s._-]/g, '');
}

function isSensitiveKey(key: string): boolean {
  const normalised = normaliseKey(key);

  if (SENSITIVE_EXACT.some((candidate) => candidate === normalised)) return true;
  return SENSITIVE_FRAGMENTS.some((fragment) => normalised.includes(fragment));
}

function isSensitiveValue(value: string): boolean {
  return JWT_PATTERN.test(value) || SUPABASE_KEY_PATTERN.test(value) || BEARER_PATTERN.test(value);
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return isSensitiveValue(value) ? REDACTED : value;
  }

  if (value === null || typeof value !== 'object') {
    // A function in a log context is a mistake rather than a secret, but printing its
    // source is never useful.
    return typeof value === 'function' ? '[function]' : value;
  }

  if (depth >= MAX_DEPTH) return '[max depth]';

  // Cycles are common in anything holding a parent reference or a native handle. Without
  // this the redactor recurses until the stack goes, inside a `catch` block.
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[+${String(value.length - MAX_ARRAY_ITEMS)} more]`);
    }
    return items;
  }

  // `Error` does not enumerate `message`/`stack`, so a plain entries walk would return
  // `{}` and lose the one thing worth logging.
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (value instanceof Date) return value.toISOString();

  // Map and Set enumerate no own properties either, so describe them rather than emitting
  // an empty object that reads like the data was there and was empty.
  if (value instanceof Map) return `[Map size=${String(value.size)}]`;
  if (value instanceof Set) return `[Set size=${String(value.size)}]`;

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redactValue(nested, depth + 1, seen);
  }
  return result;
}

/**
 * Returns a redacted copy. The input is never mutated — a logger that alters the object it
 * was handed would corrupt application state from a diagnostic call.
 */
export function redact(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet());
}

/**
 * Convenience for the common case: a log context is always a record, and typing the return
 * as such saves every call site an assertion.
 */
export function redactContext(
  context: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const redacted = redact(context);
  return typeof redacted === 'object' && redacted !== null && !Array.isArray(redacted)
    ? (redacted as Readonly<Record<string, unknown>>)
    : {};
}

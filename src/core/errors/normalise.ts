/**
 * `toAppError` is total: every possible JavaScript value maps to an `AppError`. That
 * totality is the point — a `catch` block receives `unknown`, and any branch that fails to
 * produce an error produces `undefined` instead, which surfaces as a blank error state
 * with nothing logged.
 *
 * What this file deliberately does **not** know: PostgREST codes, Postgres SQLSTATEs, HTTP
 * statuses. Those are transport concerns, and mapping them lives with the transport —
 * `src/core/database/` for Supabase, `src/core/network/` for HTTP. Teaching this module
 * about `23505` would put backend knowledge in the layer that exists to be backend-
 * agnostic ([ADR-0011](../../../docs/adr/0011-repository-pattern.md)).
 *
 * What it *does* know is platform failure shapes — a rejected `fetch`, an aborted signal —
 * because those are properties of the runtime, not of whatever is on the other end.
 */
import { AppError, isAppError } from './app-error';

/**
 * The reject reason for a transport-level `fetch` failure, which is indistinguishable from
 * offline: React Native throws `TypeError: Network request failed`, and each browser engine
 * words it differently. Matched on substrings because the exact text is not contractual.
 */
const NETWORK_FAILURE_FRAGMENTS = [
  'network request failed',
  'failed to fetch',
  'networkerror',
  'load failed',
  'network error',
  'err_internet_disconnected',
  'err_name_not_resolved',
] as const;

/** `AbortSignal.timeout()` rejects with this name; a manual `abort()` uses `AbortError`. */
const TIMEOUT_NAMES = ['TimeoutError', 'AbortTimeoutError'] as const;

interface ErrorLike {
  readonly name?: unknown;
  readonly message?: unknown;
}

function readErrorLike(value: unknown): ErrorLike | null {
  return typeof value === 'object' && value !== null ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Never throws, which matters because it runs inside error handling: a stringifier that
 * throws on a circular object turns a recoverable failure into an unhandled one.
 *
 * Deliberately avoids `String(value)` on an object — that yields `[object Object]`, which
 * costs a line in the log and says nothing. Each branch below produces something a reader
 * can act on.
 */
function describeUnknown(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  if (typeof value === 'symbol') return value.toString();

  if (typeof value === 'function') {
    return `[function ${readString(value.name) ?? 'anonymous'}]`;
  }

  // `[object Map]`, `[object Promise]`. Read before serialising because it is the fallback
  // *and* the tie-breaker below.
  const tag = Object.prototype.toString.call(value);

  try {
    const serialised = JSON.stringify(value);

    // A Map, Set, Promise or WeakMap serialises to `{}` — it has no enumerable own
    // properties — which reads in a log as "an object, and it was empty". It was not. When
    // stringification collapses a non-plain object to nothing, the tag says more.
    const collapsed = serialised === '{}' && tag !== '[object Object]';

    if (serialised !== undefined && !collapsed) return serialised;
  } catch {
    // Circular, or a value with a throwing `toJSON`. Fall through.
  }

  return `[unserialisable ${tag}]`;
}

function classifyName(name: string): 'cancelled' | 'timeout' | null {
  if (name === 'AbortError' || name === 'CanceledError') return 'cancelled';
  if (TIMEOUT_NAMES.some((candidate) => candidate === name)) return 'timeout';
  return null;
}

function isNetworkFailureMessage(message: string): boolean {
  const normalised = message.toLowerCase();
  return NETWORK_FAILURE_FRAGMENTS.some((fragment) => normalised.includes(fragment));
}

/**
 * Normalise any thrown value into an `AppError`.
 *
 * `userMessage` is never derived from the incoming message. An upstream string is exactly
 * the thing that must not reach a user, so an unrecognised failure gets the generic
 * `unknown` copy while the original text is preserved in `message` and `cause` for logs.
 */
export function toAppError(value: unknown, context?: Readonly<Record<string, unknown>>): AppError {
  if (isAppError(value)) return value;

  const errorLike = readErrorLike(value);
  const name = errorLike === null ? null : readString(errorLike.name);
  const message = errorLike === null ? null : readString(errorLike.message);

  if (name !== null) {
    const byName = classifyName(name);
    if (byName !== null) {
      return new AppError(byName, {
        message: message ?? `${name} (no message)`,
        code: name,
        context,
        cause: value,
      });
    }
  }

  if (message !== null && isNetworkFailureMessage(message)) {
    return new AppError('network', { message, code: name ?? undefined, context, cause: value });
  }

  if (value instanceof Error) {
    return new AppError('unknown', {
      message: message ?? value.name,
      code: name ?? undefined,
      context,
      cause: value,
    });
  }

  const asString = readString(value);
  if (asString !== null) {
    // A thrown string. Legal JavaScript, always a mistake, and worth keeping verbatim
    // because it is usually the only clue about where it came from.
    return new AppError('unknown', { message: asString, context, cause: value });
  }

  // An object with a usable message but no Error prototype — common from native modules
  // and from anything that crossed a serialisation boundary.
  if (message !== null) {
    return new AppError('unknown', { message, code: name ?? undefined, context, cause: value });
  }

  return new AppError('unknown', {
    message: `Non-error value thrown: ${describeUnknown(value)}`,
    context,
    cause: value,
  });
}

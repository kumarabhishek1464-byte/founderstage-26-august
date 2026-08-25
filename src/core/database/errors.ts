/**
 * The backend's error vocabulary, translated once.
 *
 * `src/core/errors/normalise.ts` deliberately knows nothing about `23505` or `PGRST116` — it is
 * the layer that exists to be backend-agnostic. This file is where that knowledge lives, and it
 * is the only place in the codebase that reads a Postgres SQLSTATE. CLAUDE.md's second rule
 * (`if (err.code === '23505') setMessage('Already exists')` is a review rejection) is only
 * enforceable because there is somewhere else for that line to go.
 *
 * ## Three vocabularies arrive here
 *
 * | Source                | Carries                             | Recognised by                     |
 * | --------------------- | ----------------------------------- | --------------------------------- |
 * | PostgREST / Postgres  | `code`: `PGRST116`, `23505`, `PT429`| a 5-char SQLSTATE or `PGRST` + 3  |
 * | GoTrue (`auth.*`)     | `status`: HTTP, `code`: a slug      | `isAuthError` (`__isAuthError`)   |
 * | the runtime           | a rejected `fetch`, an abort        | neither — delegated to `toAppError` |
 *
 * Anything unrecognised falls through to `toAppError`, so this function is total in the same
 * way that one is: a `catch` block that produced no error would render a blank error state with
 * nothing logged.
 *
 * ## Server-raised errors name their own kind
 *
 * A `SECURITY DEFINER` function knows *why* it refused — a fan-out cap, a disabled essential
 * category, a rate-limit bucket — and a SQLSTATE cannot express that: `RAISE EXCEPTION` without
 * an `ERRCODE` is always `P0001`, so every deliberate refusal would arrive indistinguishable
 * from every accidental one. The convention is a leading tag:
 *
 * ```sql
 * raise exception 'FS_RATE_LIMIT retry_after=30' using errcode = 'P0001';
 * raise exception 'FS_FORBIDDEN essential category may not be disabled' using errcode = 'P0001';
 * ```
 *
 * The tag names an `AppErrorKind` and is derived from `APP_ERROR_KINDS`, so a new kind gets a
 * wire tag without a second list to maintain. Only the tag and the `key=value` parameters after
 * it are read — the prose is for logs, and never becomes a `userMessage`. See
 * {@link serverErrorTag}, which exists so a test can pin the exact literals the migrations write.
 *
 * ## Why `details` is dropped
 *
 * A constraint violation's `details` embeds the offending row: `Key (email)=(a@b.com) already
 * exists.` The logger redacts by key *name* ([ADR-0016](../../../docs/adr/0016-logging-and-redaction.md)),
 * so a free-text string carrying a user's email passes straight through it. `message` and `hint`
 * name constraints and columns rather than values, so they are kept — they are the whole
 * diagnostic value — and `details` is deliberately discarded at the boundary rather than
 * redacted downstream.
 */
import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

import { APP_ERROR_KINDS, AppError, isAppError, toAppError } from '@/core/errors';

import type { AppErrorKind } from '@/core/errors';

/**
 * How long to wait when the server rate-limited us but did not say for how long.
 *
 * 60 seconds because that is GoTrue's own default send window, and because a wrong guess in this
 * direction costs one slow retry while the other direction hammers a limiter that is already
 * complaining. Our own limiter always names a duration
 * ([ADR-0008](../../../docs/adr/0008-rate-limiting-in-postgres.md)); this covers the paths that
 * cannot.
 */
const FALLBACK_RETRY_AFTER_SECONDS = 60;

/** The `FS_`-prefixed tag a server-raised error uses to name its `AppErrorKind`. */
export function serverErrorTag(kind: AppErrorKind): string {
  return `FS_${kind.toUpperCase()}`;
}

const KIND_BY_SERVER_TAG: ReadonlyMap<string, AppErrorKind> = new Map(
  APP_ERROR_KINDS.map((kind) => [serverErrorTag(kind), kind])
);

/**
 * PostgREST's own codes, which are about the *request* rather than about the data.
 *
 * Most of them mean this codebase built a query the schema cannot answer — an embed that is not
 * a foreign key, a column that was renamed, an RPC that was never migrated. Those map to
 * `server`: the user genuinely cannot act on them, and `reportable` is what gets them fixed. The
 * `retryable: true` that comes with `server` is wrong for a permanently malformed query, but it
 * costs a bounded handful of retries, and inventing a twelfth `AppErrorKind` for "our bug"
 * would add a kind that drives no different UI — which
 * [`app-error.ts`](../errors/app-error.ts) rules out by design.
 *
 * @see https://docs.postgrest.org/en/stable/references/errors.html
 */
const KIND_BY_POSTGREST_CODE: Readonly<Record<string, AppErrorKind>> = {
  // `.single()` matched zero rows. Also what RLS looks like on a read: a policy that excludes
  // the row is indistinguishable from the row not existing, which is the point — a probe must
  // not be able to tell "forbidden" from "absent".
  PGRST116: 'not_found',

  PGRST100: 'server', // Unparseable query string.
  PGRST102: 'server', // Unparseable body.
  PGRST103: 'server', // Invalid range — our pagination, not the user's.
  PGRST105: 'server', // Unsupported PUT.
  PGRST106: 'server', // Schema not in the exposed list.
  PGRST107: 'server', // Unsupported media type.
  PGRST108: 'server', // Filter on a column not in the select.
  PGRST200: 'server', // No relationship found for an embed.
  PGRST201: 'server', // Ambiguous embed.
  PGRST202: 'server', // No matching function — an RPC signature drifted from the migration.
  PGRST203: 'server', // Ambiguous function overload.
  PGRST204: 'server', // Column not found — generated types are stale.

  PGRST301: 'auth', // JWT missing, malformed or expired.
  PGRST302: 'auth', // Anonymous request where a JWT is required.
  PGRST303: 'auth', // JWT claim required by a policy is absent.

  PGRST121: 'server', // Malformed `RAISE` payload from a function.
  PGRST122: 'server', // Invalid preference header.
};

/**
 * SQLSTATEs worth distinguishing.
 *
 * Chosen for a different *response*, not for completeness — an exhaustive table would be a few
 * hundred rows of which all but these fall to `server` anyway. `40001` and `40P01` are the
 * interesting ones: a serialization failure or a deadlock is genuinely transient, and `server`
 * carries `retryable: true`, so the query layer backs off and succeeds rather than surfacing a
 * failure the user cannot understand.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const KIND_BY_SQLSTATE: Readonly<Record<string, AppErrorKind>> = {
  // Class 08 — connection exception. Indistinguishable from offline from here.
  '08000': 'network',
  '08001': 'network',
  '08003': 'network',
  '08004': 'network',
  '08006': 'network',
  '08007': 'network',
  '08P01': 'network',

  // Class 22 — data exception. A malformed uuid or an overlong string is bad input.
  '22001': 'validation',
  '22003': 'validation',
  '22007': 'validation',
  '22008': 'validation',
  '22023': 'validation',
  '22P02': 'validation',

  // Class 23 — integrity constraint violation.
  '23502': 'validation', // not_null_violation
  '23503': 'validation', // foreign_key_violation — the referenced row is wrong, not missing.
  '23505': 'conflict', // unique_violation
  '23514': 'validation', // check_violation — including the `payload` key allowlist.
  '23P01': 'conflict', // exclusion_violation

  // Class 40 — transaction rollback. Transient by definition; `server` retries.
  '40001': 'server', // serialization_failure
  '40P01': 'server', // deadlock_detected

  // Class 42 — syntax or access rule violation.
  '42501': 'forbidden', // insufficient_privilege — a revoked grant, i.e. RLS on a write.
  '42601': 'server', // syntax_error
  '42703': 'server', // undefined_column
  '42883': 'server', // undefined_function
  '42P01': 'server', // undefined_table

  // Class 53/54/55 — insufficient resources and limits. Ours to fix, transient to the user.
  '53100': 'server',
  '53200': 'server',
  '53300': 'server',
  '54000': 'server',
  '54001': 'server',
  '55P03': 'server', // lock_not_available

  // Class 57 — operator intervention. `57014` is `statement_timeout`, which is a real timeout.
  '57014': 'timeout',
  '57P01': 'server', // admin_shutdown
  '57P02': 'server', // crash_shutdown
  '57P03': 'server', // cannot_connect_now
};

/**
 * GoTrue error codes whose correct handling differs from what their HTTP status implies.
 *
 * The copy is written here, not in a screen, and it is written as a literal — never derived from
 * the server's text. A sign-in that failed needs "that email or password is incorrect", not
 * `auth`'s default "please sign in to continue", which is what the user just tried to do.
 *
 * @see https://supabase.com/docs/guides/auth/debugging/error-codes
 */
const AUTH_CODE_POLICY: Readonly<
  Record<string, { readonly kind: AppErrorKind; readonly userMessage?: string }>
> = {
  invalid_credentials: {
    kind: 'auth',
    // Deliberately ambiguous about which of the two was wrong: naming the email would turn the
    // sign-in form into an account-existence oracle.
    userMessage: 'That email or password is incorrect.',
  },
  email_not_confirmed: {
    kind: 'auth',
    userMessage: 'Confirm your email address to continue. Check your inbox for the link.',
  },
  email_exists: { kind: 'conflict', userMessage: 'An account with that email already exists.' },
  user_already_exists: {
    kind: 'conflict',
    userMessage: 'An account with that email already exists.',
  },
  weak_password: {
    kind: 'validation',
    userMessage: 'Choose a stronger password — at least 8 characters, with a number.',
  },
  same_password: {
    kind: 'validation',
    userMessage: 'That is your current password. Choose a different one.',
  },
  otp_expired: {
    kind: 'auth',
    userMessage: 'That code has expired. Request a new one.',
  },
  signup_disabled: {
    kind: 'forbidden',
    userMessage: 'New accounts are temporarily closed. Please try again later.',
  },
  captcha_failed: {
    kind: 'validation',
    userMessage: "We couldn't verify that you're human. Please try again.",
  },

  // The session is gone rather than invalid. `auth` sends the user to sign-in, which is right,
  // and the default copy is already the right words for it.
  session_not_found: { kind: 'auth' },
  session_expired: { kind: 'auth' },
  refresh_token_not_found: { kind: 'auth' },
  refresh_token_already_used: { kind: 'auth' },
  bad_jwt: { kind: 'auth' },

  over_request_rate_limit: { kind: 'rate_limit' },
  over_email_send_rate_limit: { kind: 'rate_limit' },
  over_sms_send_rate_limit: { kind: 'rate_limit' },
};

/**
 * HTTP status → kind, shared by GoTrue statuses and PostgREST's `PTxxx` SQLSTATEs.
 *
 * An unmapped 4xx becomes `unknown` rather than `validation`: `validation`'s copy ("check the
 * highlighted fields") is a lie on a screen with no fields, and `unknown` at least says
 * something true. It costs a few retries, since `unknown` is retryable — the honest wrong answer
 * over the cheap one.
 */
function kindForHttpStatus(status: number): AppErrorKind {
  if (status >= 500) return 'server';

  switch (status) {
    case 400:
      return 'validation';
    case 401:
      return 'auth';
    case 403:
      return 'forbidden';
    case 404:
    case 410:
      return 'not_found';
    case 408:
      return 'timeout';
    case 409:
      return 'conflict';
    case 413:
    case 414:
    case 415:
    case 422:
      return 'validation';
    case 429:
      return 'rate_limit';
    // nginx's "client closed request". Reached when the user navigates away mid-flight.
    case 499:
      return 'cancelled';
    default:
      return 'unknown';
  }
}

/**
 * GoTrue's statuses, which differ from the generic table at exactly one code.
 *
 * A 400 from GoTrue is almost never a form problem — it is a bad credential, a missing session, an
 * expired grant. `validation`'s copy ("check the highlighted fields") on a sign-in screen whose
 * fields are both filled in correctly is actively misleading, and it does not send the user
 * anywhere. `auth` does. Genuine input rejections from GoTrue arrive as 422, or with a code that
 * {@link AUTH_CODE_POLICY} already maps to `validation`.
 */
function kindForAuthStatus(status: number): AppErrorKind {
  return status === 400 ? 'auth' : kindForHttpStatus(status);
}

interface PostgrestErrorLike {
  readonly code: string;
  readonly message: string;
  readonly hint: string | null;
}

/**
 * A PostgREST error, or `null`.
 *
 * The `code` *shape* is the discriminator, not the presence of a `code` property: Node and React
 * Native attach `code` to plain errors too, and treating one of those as a database error would map
 * a filesystem or DNS failure to `server` instead of letting `toAppError` recognise what it is.
 *
 * `[0-9A-Z]{5}` would be the obvious pattern for a SQLSTATE and is too loose — `EPERM` and `EBUSY`
 * are five uppercase characters. Every SQLSTATE class Postgres defines begins with a digit or with
 * `F`, `H`, `P` or `X`, which is what excludes the `E`-prefixed libuv codes without needing to
 * enumerate them.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
function readPostgrestError(value: unknown): PostgrestErrorLike | null {
  if (typeof value !== 'object' || value === null) return null;

  const candidate = value as {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly hint?: unknown;
  };

  if (typeof candidate.code !== 'string' || typeof candidate.message !== 'string') return null;
  if (!/^(?:PGRST[0-9]{3}|[0-9FHPX][0-9A-Z]{4})$/u.test(candidate.code)) return null;

  return {
    code: candidate.code,
    message: candidate.message,
    hint: typeof candidate.hint === 'string' && candidate.hint.length > 0 ? candidate.hint : null,
  };
}

interface ServerTag {
  readonly kind: AppErrorKind;
  readonly retryAfterSeconds: number | null;
}

/**
 * The `FS_<KIND>` tag a server-raised message opens with, or `null` if it has none.
 *
 * `retry_after` is the only parameter read today. Others (`field=`, `limit=`) are the reason the
 * format is `key=value` pairs rather than a positional colon-delimited string — adding one later
 * must not change how existing messages parse.
 */
function readServerTag(message: string): ServerTag | null {
  const tag = /^(FS_[A-Z_]+)/u.exec(message)?.[1];
  if (tag === undefined) return null;

  const kind = KIND_BY_SERVER_TAG.get(tag);
  if (kind === undefined) return null;

  const seconds = /\bretry_after=([0-9]{1,6})\b/u.exec(message)?.[1];

  return {
    kind,
    retryAfterSeconds: seconds === undefined ? null : Number.parseInt(seconds, 10),
  };
}

/**
 * PostgREST maps a SQLSTATE of `PT` plus three digits to that HTTP status, which is how a
 * function returns a real 429 rather than a 500 the client has to guess at. Worth honouring
 * here so the choice is available to a migration without a second client change.
 */
function kindForPostgrestStatusCode(code: string): AppErrorKind | null {
  const status = /^PT([0-9]{3})$/u.exec(code)?.[1];
  return status === undefined ? null : kindForHttpStatus(Number.parseInt(status, 10));
}

/**
 * Assemble the final `AppError`, routing `rate_limit` through the factory that requires a
 * duration. Centralised so that no branch above can produce a `rate_limit` without one — which
 * would leave the retry policy guessing at the one kind whose whole contract is "wait this long".
 */
function build(
  kind: AppErrorKind,
  options: {
    readonly message: string;
    readonly userMessage?: string;
    readonly code?: string;
    readonly retryAfterSeconds?: number | null;
    readonly context?: Readonly<Record<string, unknown>>;
    readonly cause: unknown;
  }
): AppError {
  const { retryAfterSeconds, ...rest } = options;

  if (kind === 'rate_limit') {
    return AppError.rateLimit({
      ...rest,
      retryAfterSeconds: retryAfterSeconds ?? FALLBACK_RETRY_AFTER_SECONDS,
    });
  }

  return new AppError(kind, rest);
}

/**
 * Normalise anything a Supabase call can produce into an `AppError`.
 *
 * ```ts
 * const { data, error } = await client.from('notifications').select('id, created_at');
 * if (error !== null) throw toDatabaseError(error, { operation: 'notifications.page' });
 * ```
 *
 * `context` is for diagnostics and is redacted by the logger before it is written, so it may
 * carry an operation name or an entity id — never a token, a payload or a message body (§48).
 */
export function toDatabaseError(
  error: unknown,
  context?: Readonly<Record<string, unknown>>
): AppError {
  if (isAppError(error)) return error;

  // A transport failure inside GoTrue's own retry loop. Checked before the status table because
  // it has no status at all — it never reached the server.
  if (isAuthRetryableFetchError(error)) {
    return new AppError('network', { message: error.message, context, cause: error });
  }

  if (isAuthError(error)) {
    const policy = error.code === undefined ? undefined : AUTH_CODE_POLICY[error.code];
    const kind =
      policy?.kind ?? (error.status === undefined ? 'auth' : kindForAuthStatus(error.status));

    return build(kind, {
      message: error.message,
      userMessage: policy?.userMessage,
      code: error.code,
      context: { ...context, status: error.status },
      cause: error,
    });
  }

  const postgrest = readPostgrestError(error);
  if (postgrest === null) return toAppError(error, context);

  const { code, message, hint } = postgrest;
  const tag = readServerTag(message);

  // A tag wins over the SQLSTATE. `RAISE` without an `ERRCODE` is always `P0001`, so the
  // SQLSTATE carries no information for a deliberate refusal — the tag is the only signal.
  const kind =
    tag?.kind ??
    KIND_BY_POSTGREST_CODE[code] ??
    KIND_BY_SQLSTATE[code] ??
    kindForPostgrestStatusCode(code) ??
    'server';

  return build(kind, {
    message,
    code,
    retryAfterSeconds: tag?.retryAfterSeconds,
    // `details` is deliberately absent — see the module docblock.
    context: hint === null ? context : { ...context, hint },
    cause: error,
  });
}

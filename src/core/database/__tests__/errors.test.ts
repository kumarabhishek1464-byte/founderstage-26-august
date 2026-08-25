/**
 * This suite exists because the mapping table is the only thing standing between a raw Postgres
 * error and a user's screen, and every entry in it is a claim about UI behaviour rather than about
 * strings. `42501` → `forbidden` means "do not send this signed-in user to the sign-in screen";
 * `23505` → `conflict` means "do not offer a retry button". So the assertions below are mostly on
 * `kind`, `retryable` and `reportable` — the three fields that actually change what happens — and
 * only incidentally on copy.
 *
 * Three properties get more attention than the table:
 *
 * 1. **Nothing sensitive survives.** A unique-violation's `details` carries the offending value
 *    (`Key (email)=(a@b.com) already exists.`) and the logger cannot redact a free-text string, so
 *    the boundary has to drop it. There is a test that fails if it ever comes back.
 * 2. **No server text becomes a `userMessage`.** The one guarantee `AppError` makes to a screen is
 *    that `userMessage` was written by us. A mapping that passed `error.message` through would
 *    satisfy every `kind` assertion here and still leak a constraint name into the UI.
 * 3. **Shape discrimination is narrow.** `EPERM` is five uppercase characters and is not a
 *    SQLSTATE. A looser check would swallow runtime errors into `server` and lose the `network`
 *    classification that drives the offline banner.
 *
 * Real `AuthApiError` instances are constructed rather than faked, because `isAuthError` tests for
 * a `protected __isAuthError` field — a hand-rolled object literal would pass the predicate today
 * and diverge silently if auth-js changed its marker.
 */
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from '@supabase/supabase-js';

import { serverErrorTag, toDatabaseError } from '@/core/database';
import { APP_ERROR_KINDS, AppError, isRateLimited } from '@/core/errors';

import type { AppErrorKind } from '@/core/errors';

/**
 * A `PostgrestError` as it arrives on `{ data, error }` — a plain object, not an `Error` subclass,
 * which is itself part of what `readPostgrestError` has to cope with.
 */
function postgrestError(
  code: string,
  overrides: { message?: string; details?: string | null; hint?: string | null } = {}
): unknown {
  return {
    name: 'PostgrestError',
    code,
    message: overrides.message ?? `simulated ${code}`,
    details: overrides.details ?? null,
    hint: overrides.hint ?? null,
  };
}

describe('toDatabaseError — PostgREST codes', () => {
  it.each([
    ['PGRST116', 'not_found'],
    ['PGRST202', 'server'],
    ['PGRST204', 'server'],
    ['PGRST301', 'auth'],
    ['PGRST302', 'auth'],
  ] as const)('maps %s to %s', (code, kind) => {
    expect(toDatabaseError(postgrestError(code)).kind).toBe(kind);
  });

  /**
   * RLS on a read is indistinguishable from absence, and deliberately so: if a filtered row
   * produced `forbidden` while a missing row produced `not_found`, an attacker could enumerate
   * which ids exist by reading the difference.
   */
  it('does not report a no-rows result — it is a normal outcome, not a defect', () => {
    const error = toDatabaseError(postgrestError('PGRST116'));

    expect(error.reportable).toBe(false);
    expect(error.retryable).toBe(false);
  });

  /**
   * The inverse: a missing RPC means a migration and a call site disagree, which no user can act
   * on and no retry can fix. It has to reach crash reporting or it is invisible until support
   * tickets arrive.
   */
  it('reports a missing function, because that is a deployment defect', () => {
    expect(toDatabaseError(postgrestError('PGRST202')).reportable).toBe(true);
  });
});

describe('toDatabaseError — SQLSTATEs', () => {
  it.each([
    ['08006', 'network'],
    ['22P02', 'validation'],
    ['23502', 'validation'],
    ['23505', 'conflict'],
    ['23514', 'validation'],
    ['23P01', 'conflict'],
    ['42501', 'forbidden'],
    ['42P01', 'server'],
    ['57014', 'timeout'],
  ] as const)('maps %s to %s', (code, kind) => {
    expect(toDatabaseError(postgrestError(code)).kind).toBe(kind);
  });

  /**
   * The distinction that made `40001` worth a table row: a serialization failure is transient, so
   * the query layer must be told it can retry. Mapping it to `conflict` — which reads plausible,
   * since two transactions did conflict — would surface a permanent-looking failure for something
   * that succeeds on the next attempt.
   */
  it.each(['40001', '40P01'])('treats %s as retryable', (code) => {
    expect(toDatabaseError(postgrestError(code)).retryable).toBe(true);
  });

  it('does not offer a retry on a unique violation', () => {
    expect(toDatabaseError(postgrestError('23505')).retryable).toBe(false);
  });

  /**
   * `forbidden` and not `auth`. A signed-in user who lacks a grant, sent to the sign-in screen,
   * signs in successfully and arrives back at the same denial — a loop with no exit.
   */
  it('keeps an insufficient-privilege error away from the sign-in screen', () => {
    const error = toDatabaseError(postgrestError('42501'));

    expect(error.kind).toBe('forbidden');
    expect(error.userMessage).toBe("You don't have access to this.");
  });

  it('falls back to server for a SQLSTATE with no entry', () => {
    expect(toDatabaseError(postgrestError('2F005')).kind).toBe('server');
  });

  it('preserves the upstream code for logs', () => {
    expect(toDatabaseError(postgrestError('23505')).code).toBe('23505');
  });
});

describe('toDatabaseError — PTxxx status passthrough', () => {
  it.each([
    ['PT429', 'rate_limit'],
    ['PT404', 'not_found'],
    ['PT403', 'forbidden'],
    ['PT503', 'server'],
  ] as const)('maps %s to %s', (code, kind) => {
    expect(toDatabaseError(postgrestError(code)).kind).toBe(kind);
  });

  it('gives a PT429 a duration even though the code carries none', () => {
    const error = toDatabaseError(postgrestError('PT429'));

    expect(isRateLimited(error)).toBe(true);
    expect(error.retryAfterSeconds).toBe(60);
  });
});

describe('toDatabaseError — server-raised FS_ tags', () => {
  it('reads the kind and the duration out of the message', () => {
    const error = toDatabaseError(
      postgrestError('P0001', { message: 'FS_RATE_LIMIT retry_after=30 bucket=notify.emit' })
    );

    expect(error.kind).toBe('rate_limit');
    expect(error.retryAfterSeconds).toBe(30);
  });

  /**
   * The reason the tag exists at all. `RAISE EXCEPTION` without an explicit `ERRCODE` is always
   * `P0001`, so every deliberate refusal a `SECURITY DEFINER` function makes — a disabled
   * essential category, a breached fan-out cap, a rate-limit bucket — arrives under the same
   * SQLSTATE as every accidental one.
   */
  it('lets the tag override the SQLSTATE it arrives under', () => {
    const forbidden = toDatabaseError(
      postgrestError('P0001', { message: 'FS_FORBIDDEN essential category may not be disabled' })
    );
    const untagged = toDatabaseError(postgrestError('P0001', { message: 'something went wrong' }));

    expect(forbidden.kind).toBe('forbidden');
    expect(untagged.kind).toBe('server');
  });

  it('wins over a SQLSTATE that does have a mapping', () => {
    const error = toDatabaseError(
      postgrestError('23505', { message: 'FS_RATE_LIMIT retry_after=5' })
    );

    expect(error.kind).toBe('rate_limit');
  });

  it('ignores a tag naming a kind that does not exist', () => {
    const error = toDatabaseError(
      postgrestError('23505', { message: 'FS_TEAPOT something imaginary' })
    );

    expect(error.kind).toBe('conflict');
  });

  it('only reads a tag at the start of the message', () => {
    const error = toDatabaseError(
      postgrestError('23505', { message: 'a row mentioning FS_RATE_LIMIT in passing' })
    );

    expect(error.kind).toBe('conflict');
  });

  it('supplies the fallback duration when a tagged rate limit omits one', () => {
    const error = toDatabaseError(postgrestError('P0001', { message: 'FS_RATE_LIMIT' }));

    expect(error.retryAfterSeconds).toBe(60);
  });

  /**
   * `serverErrorTag` is the contract the migrations write against, so its output is pinned here.
   * A rename of an `AppErrorKind` then fails this test rather than silently downgrading every
   * server-raised error of that kind to `server` at runtime.
   */
  it('derives every tag from APP_ERROR_KINDS', () => {
    expect(serverErrorTag('rate_limit')).toBe('FS_RATE_LIMIT');
    expect(serverErrorTag('forbidden')).toBe('FS_FORBIDDEN');
    expect(serverErrorTag('not_found')).toBe('FS_NOT_FOUND');
  });

  it('round-trips every kind', () => {
    for (const kind of APP_ERROR_KINDS) {
      const error = toDatabaseError(
        postgrestError('P0001', { message: `${serverErrorTag(kind)} deliberate` })
      );

      expect(error.kind).toBe<AppErrorKind>(kind);
    }
  });
});

describe('toDatabaseError — what must not escape', () => {
  /**
   * A unique violation on an email column produces
   * `details: 'Key (email)=(founder@example.com) already exists.'`. ADR-0016 redacts by key name,
   * and `details` is one string — so there is no key called `email` for the redactor to find, and
   * the address would be written to the log verbatim. Dropping it at the boundary is the only
   * control that works.
   */
  it('drops details, which embeds the offending value', () => {
    const error = toDatabaseError(
      postgrestError('23505', {
        message: 'duplicate key value violates unique constraint "profiles_email_key"',
        details: 'Key (email)=(founder@example.com) already exists.',
      }),
      { operation: 'profiles.create' }
    );

    const everythingReadable = JSON.stringify({
      message: error.message,
      userMessage: error.userMessage,
      code: error.code,
      context: error.context,
    });

    expect(everythingReadable).not.toContain('founder@example.com');
    // The constraint name survives, because that is the part with diagnostic value and no PII.
    expect(error.message).toContain('profiles_email_key');
  });

  it('keeps hint, which names columns rather than values', () => {
    const error = toDatabaseError(
      postgrestError('PGRST202', { hint: 'Perhaps you meant mark_read' })
    );

    expect(error.context).toMatchObject({ hint: 'Perhaps you meant mark_read' });
  });

  it('merges caller context instead of replacing it', () => {
    const error = toDatabaseError(postgrestError('23505', { hint: 'try again' }), {
      operation: 'notifications.page',
    });

    expect(error.context).toMatchObject({ operation: 'notifications.page', hint: 'try again' });
  });

  /**
   * The leak this whole file is arranged around. A `userMessage` derived from server text passes
   * every `kind` assertion above and puts a table name on a user's screen.
   */
  it('never derives userMessage from server text', () => {
    const secret = 'relation "internal_audit_log" does not exist';
    const error = toDatabaseError(postgrestError('42P01', { message: secret }));

    expect(error.message).toBe(secret);
    expect(error.userMessage).not.toContain('internal_audit_log');
    expect(error.userMessage).toBe('Something went wrong on our end. Please try again.');
  });

  it('preserves the original as cause', () => {
    const original = postgrestError('23505');

    expect(toDatabaseError(original).cause).toBe(original);
  });
});

describe('toDatabaseError — GoTrue errors', () => {
  it('uses our own copy for invalid credentials', () => {
    const error = toDatabaseError(new AuthApiError('Invalid login', 400, 'invalid_credentials'));

    expect(error.kind).toBe('auth');
    expect(error.userMessage).toBe('That email or password is incorrect.');
  });

  /**
   * Deliberately ambiguous about which half was wrong. Copy that said "no account with that email"
   * turns the sign-in form into an account-existence oracle — one request per address tells an
   * attacker who has an account here.
   */
  it('does not reveal whether the account exists', () => {
    const error = toDatabaseError(new AuthApiError('Invalid login', 400, 'invalid_credentials'));

    expect(error.userMessage).not.toMatch(/no account|not registered|unknown email/iu);
  });

  it.each([
    ['email_exists', 'conflict'],
    ['weak_password', 'validation'],
    ['signup_disabled', 'forbidden'],
    ['otp_expired', 'auth'],
    ['over_email_send_rate_limit', 'rate_limit'],
  ] as const)('maps the %s code to %s', (code, kind) => {
    expect(toDatabaseError(new AuthApiError('simulated', 429, code)).kind).toBe(kind);
  });

  it('gives a GoTrue rate limit a duration, since auth-js drops Retry-After', () => {
    const error = toDatabaseError(
      new AuthApiError('over_request_rate_limit', 429, 'over_request_rate_limit')
    );

    expect(isRateLimited(error)).toBe(true);
    expect(error.retryAfterSeconds).toBe(60);
  });

  /**
   * GoTrue answers 400 for a bad credential, an expired grant and a missing session. Running those
   * through the generic HTTP table would call them `validation` and render "check the highlighted
   * fields" on a screen whose fields are correct — and, worse, leave the user with nowhere to go.
   */
  it('treats an uncoded 400 as an auth failure, not a form problem', () => {
    expect(toDatabaseError(new AuthSessionMissingError()).kind).toBe('auth');
  });

  it('still honours the generic table above 400', () => {
    expect(toDatabaseError(new AuthApiError('boom', 503, undefined)).kind).toBe('server');
    expect(toDatabaseError(new AuthApiError('nope', 403, undefined)).kind).toBe('forbidden');
    expect(toDatabaseError(new AuthApiError('bad input', 422, undefined)).kind).toBe('validation');
  });

  /**
   * Checked before the status table because it has no meaningful status — GoTrue constructs it
   * with `0` when `fetch` rejected, so the request never reached a server. `network` is what
   * drives the offline copy and keeps it out of crash reporting.
   */
  it('classifies a failed fetch inside GoTrue as network', () => {
    const error = toDatabaseError(new AuthRetryableFetchError('Failed to fetch', 0));

    expect(error.kind).toBe('network');
    expect(error.retryable).toBe(true);
    expect(error.reportable).toBe(false);
  });

  it('records the status in context without putting it on screen', () => {
    const error = toDatabaseError(new AuthApiError('simulated', 401, undefined));

    expect(error.context).toMatchObject({ status: 401 });
    expect(error.userMessage).not.toContain('401');
  });
});

describe('toDatabaseError — everything else', () => {
  it('returns an AppError unchanged rather than wrapping it twice', () => {
    const original = new AppError('forbidden', { message: 'already normalised' });

    expect(toDatabaseError(original)).toBe(original);
  });

  it('delegates a transport failure to toAppError', () => {
    expect(toDatabaseError(new TypeError('Network request failed')).kind).toBe('network');
  });

  it('delegates an abort to toAppError', () => {
    const aborted = new Error('The user aborted a request.');
    aborted.name = 'AbortError';

    expect(toDatabaseError(aborted).kind).toBe('cancelled');
  });

  /**
   * `EPERM` and `EBUSY` are five uppercase characters, so a `[0-9A-Z]{5}` check would read them as
   * SQLSTATEs and flatten them to `server`. Postgres classes all begin with a digit or F/H/P/X.
   */
  it.each(['EPERM', 'EBUSY', 'ENOENT', 'ECONNRESET'])(
    'does not mistake the runtime code %s for a SQLSTATE',
    (code) => {
      const error = toDatabaseError({ code, message: 'Network request failed' });

      expect(error.kind).toBe('network');
    }
  );

  it('ignores a code-shaped value with no message', () => {
    // No `message`, so it is not a PostgREST error however plausible the code looks.
    expect(toDatabaseError({ code: '23505' }).kind).toBe('unknown');
  });

  it('is total', () => {
    expect(toDatabaseError(undefined).kind).toBe('unknown');
    expect(toDatabaseError(null).kind).toBe('unknown');
    expect(toDatabaseError('a thrown string').message).toBe('a thrown string');
  });
});

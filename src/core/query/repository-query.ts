/**
 * `createRepositoryQuery` — the wrapper every repository method goes through.
 *
 * ```ts
 * export const notificationRepository = {
 *   page: createRepositoryQuery('notifications.page', async (input: PageInput) => {
 *     const { data, error } = await client.rpc('page_notifications', { … });
 *     if (error !== null) throw error;
 *     return data.map(toNotification);
 *   }),
 * };
 * ```
 *
 * Two jobs, and the reason they are one wrapper is that both are things a feature would otherwise
 * have to *remember*:
 *
 * 1. **Normalisation.** Whatever the call threw leaves here as an `AppError`, via `toDatabaseError`
 *    — the only module that reads a SQLSTATE. A repository therefore throws the raw Supabase error
 *    and is done; no feature contains `if (err.code === '23505')`, which CLAUDE.md's second rule
 *    makes a review rejection.
 * 2. **Measurement.** Every backend call is timed from one place, so API latency exists for features
 *    that never asked for it. [ADR-0006](../../../docs/adr/0006-tanstack-query-and-cache-tiers.md)
 *    §"One wrapper for every repository call".
 *
 * ## What it deliberately does not log
 *
 * **The arguments.** A repository's input is the payload — a search term, a preference change, a
 * device token, a page cursor. The redactor works by key *name* and would pass a free-text search
 * string straight through, so the arguments never reach a log line at all (§48). What is logged is
 * the operation name, which is a literal in this file's call sites and therefore safe by
 * construction.
 *
 * **The failure.** A failed call is logged once, by the query or mutation cache in `client.ts`,
 * after retries are exhausted. Logging it here too would produce one line per *attempt* plus the
 * cache's line, and a retried timeout would read as four separate outages. This wrapper records the
 * span either way — a failed call's duration is the interesting part of a timeout — and leaves the
 * error to the layer that knows whether it was final.
 *
 * ## The span is a timed log line, for now
 *
 * There is no tracing backend yet. When one arrives it attaches as a `LogTransport`
 * ([ADR-0016](../../../docs/adr/0016-logging-and-redaction.md)) and this stays the single place a
 * repository call is instrumented, which is the point of routing every call through here before
 * there is anything to send.
 */
import { toDatabaseError } from '@/core/database';
import { logger } from '@/core/observability';

import type { AppErrorKind } from '@/core/errors';

/**
 * Above this, the call is logged at `warn` instead of `trace`.
 *
 * One second is roughly where a list stops feeling like it is loading and starts feeling broken. The
 * threshold is not a budget — it is the line above which a call is worth seeing in a log that is
 * filtered to `warn` in a release build, which is where a slow query is actually noticed.
 */
const SLOW_CALL_MS = 1_000;

/**
 * `performance.now` where it exists, `Date.now` otherwise.
 *
 * `performance` is present in every browser and in Hermes, so the fallback is close to unreachable —
 * but it is a global that a Jest environment or an older runtime can omit, and a repository call
 * that threw a `TypeError` on the first line of its instrumentation would be a spectacular way to
 * break every screen at once. `Date.now` is worse only in that it can step with a clock change.
 */
function now(): number {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

/**
 * Wrap a repository call.
 *
 * `operation` is a `feature.method` literal — `'notifications.page'`, `'account.updateProfile'` —
 * because it becomes the dimension the latency is grouped by, and a computed name produces a
 * cardinality explosion in whatever eventually aggregates it.
 *
 * The returned function keeps the wrapped signature exactly, so a repository reads as a record of
 * plain async methods at the call site and the wrapper is invisible to consumers.
 */
export function createRepositoryQuery<TArgs extends readonly unknown[], TResult>(
  operation: string,
  run: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const startedAt = now();

    try {
      const result = await run(...args);
      record(operation, now() - startedAt, null);
      return result;
    } catch (error) {
      // Normalised *before* the span is recorded, so `kind` is on the line: a slow call that ended
      // in `timeout` and a slow call that ended in `conflict` are different problems.
      const appError = toDatabaseError(error, { operation });
      record(operation, now() - startedAt, appError.kind);
      throw appError;
    }
  };
}

function record(operation: string, durationMs: number, kind: AppErrorKind | null): void {
  const context = {
    operation,
    durationMs: Math.round(durationMs),
    outcome: kind === null ? 'success' : 'error',
    ...(kind === null ? {} : { kind }),
  };

  // A cancelled call is not slow, it is abandoned — the duration measures how long the user looked
  // at the screen before navigating away, and warning about it would fill the log with the app
  // working correctly.
  if (durationMs >= SLOW_CALL_MS && kind !== 'cancelled') {
    logger.warn('Slow repository call', context);
    return;
  }

  logger.trace('Repository call', context);
}

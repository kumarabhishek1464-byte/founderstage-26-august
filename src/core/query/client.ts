/**
 * The `QueryClient`, and the retry policy that is the reason it is composed here rather than
 * inline in a provider.
 *
 * `AppError` already carries the two facts a retry policy needs — `retryable` per kind, and
 * `retryAfterSeconds` on a `rate_limit` ([ADR-0015](../../../docs/adr/0015-error-model.md)) — so
 * this file does not re-derive them from a status code. It reads them. That is what keeps "which
 * failures are worth retrying" a single table in `app-error.ts` instead of a judgement repeated in
 * every hook.
 *
 * ## Three things the default policy gets wrong
 *
 * TanStack's default is three retries with exponential backoff for **everything**. Against this
 * error model that is wrong in three specific ways, and each is fixed below:
 *
 * 1. **`cancelled` is not a failure.** A superseded query or a screen the user navigated away from
 *    arrives here as an error, and retrying it fetches data for a component that no longer exists.
 * 2. **`forbidden`, `not_found` and `validation` cannot succeed on a second attempt.** Retrying an
 *    RLS denial three times is three round trips to reach the same conclusion, times every row in
 *    a list that failed to load.
 * 3. **A `rate_limit` has a server-supplied wait.** Backing off by our own curve either retries
 *    before the window opens — burning the bucket the limiter is protecting
 *    ([ADR-0008](../../../docs/adr/0008-rate-limiting-in-postgres.md)) — or waits longer than
 *    necessary.
 *
 * ## Why the error type stays `Error`
 *
 * TanStack allows the global error type to be declared as `AppError` through module augmentation,
 * which would let a screen read `error.userMessage` with no narrowing. It is not done here, because
 * the declaration is a claim the compiler cannot check: a `queryFn` that throws a raw `TypeError`
 * would satisfy the type and produce `undefined` where the UI expects a sentence. In practice every
 * query goes through `createRepositoryQuery`, which normalises — but "in practice" is not what a
 * type means. So the policy below normalises defensively, and `ErrorState` normalises again at the
 * render boundary. Both are cheap; `toAppError` returns an existing `AppError` unchanged.
 *
 * ## What lives elsewhere
 *
 * `onlineManager` and `focusManager` are wired in `src/core/network/` — they need NetInfo and
 * `AppState`, and a `QueryClient` module that reached for either would be untestable without them.
 * Until that wiring runs, `networkMode: 'online'` behaves as though the app is always online, which
 * is the pre-existing behaviour rather than a regression.
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { isRateLimited, toAppError } from '@/core/errors';
import { logger } from '@/core/observability';

/**
 * Four attempts, not three retries. Counting attempts is the form the comparison below actually
 * needs, and it is the number that matters when reading a network log.
 *
 * Four because the failure this exists for is a transient one — a serialization failure, a dropped
 * socket on a train — and those clear inside a couple of seconds or not at all. A fifth attempt
 * adds latency to a request that has already told us three times.
 */
const MAX_ATTEMPTS = 4;

/**
 * A rate limit gets exactly one retry.
 *
 * The server has already said "you are asking too often". Two more attempts on that bucket are
 * two more rows in the limiter's table and two more chances to extend the window
 * ([ADR-0008](../../../docs/adr/0008-rate-limiting-in-postgres.md) §"The port"). One retry covers
 * the common case — a burst that has since drained — and anything beyond it belongs to the user,
 * who can pull to refresh.
 */
const RATE_LIMIT_MAX_ATTEMPTS = 2;

/**
 * Above this, do not wait — fail and let the UI say so.
 *
 * A `retry_after` of five minutes is a real answer, and honouring it literally would leave a query
 * pending for five minutes: a skeleton with no explanation, on a screen whose `gcTime` has long
 * since passed. `rate_limit`'s `userMessage` ("too many attempts, please wait a moment") is the
 * better outcome, because it is information rather than a spinner.
 */
const MAX_RATE_LIMIT_WAIT_SECONDS = 30;

const MILLISECONDS_PER_SECOND = 1_000;

/** First retry lands between 250ms and 500ms — after a dropped frame, before a user notices. */
const BASE_RETRY_DELAY_MS = 500;

/** Ceiling on the exponential curve, so attempt four is not eight seconds of silence. */
const MAX_RETRY_DELAY_MS = 4_000;

/**
 * How many leading segments of a query key reach a log.
 *
 * Two, because ADR-0006's key factories put the domain in the first two — `['notifications',
 * 'list', userId, filter]` — and everything after that is ids, filters and search terms. A search
 * term is user content, and user content does not belong in a log line (§48). The redactor works by
 * key *name* and would not catch it, so it is dropped here instead.
 */
const QUERY_KEY_SCOPE_DEPTH = 2;

function describeQueryKey(queryKey: readonly unknown[]): string {
  const scope: string[] = [];

  for (const segment of queryKey) {
    if (scope.length >= QUERY_KEY_SCOPE_DEPTH) break;
    // Stops at the first non-string rather than skipping it: a key whose second segment is an
    // object is not one of ADR-0006's, and guessing at its shape is how a filter object ends up
    // stringified into a log.
    if (typeof segment !== 'string') break;
    scope.push(segment);
  }

  return scope.length === 0 ? '(unnamed)' : scope.join('.');
}

/**
 * Whether an operation that just failed should be attempted again.
 *
 * Exported for its own tests. [ADR-0014](../../../docs/adr/0014-testing-strategy.md) asks for the
 * policy primitives to be tested directly, and a retry decision reached through a real query is a
 * test that measures TanStack rather than this rule.
 *
 * `failureCount` is TanStack's: 1 on the first failure, so `failureCount < MAX_ATTEMPTS` permits
 * exactly `MAX_ATTEMPTS` attempts in total.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const appError = toAppError(error);

  // Checked ahead of `retryable` rather than relying on it, because the two say different things:
  // `cancelled` is not "a failure we should not retry", it is not a failure.
  if (appError.kind === 'cancelled') return false;

  if (!appError.retryable) return false;

  if (isRateLimited(appError)) {
    return (
      appError.retryAfterSeconds <= MAX_RATE_LIMIT_WAIT_SECONDS &&
      failureCount < RATE_LIMIT_MAX_ATTEMPTS
    );
  }

  return failureCount < MAX_ATTEMPTS;
}

/**
 * How long to wait before the next attempt, in milliseconds.
 *
 * Exponential with **equal** jitter — half the delay is fixed, half is random — rather than full
 * jitter. Full jitter can produce a delay near zero, which for a server that has just returned a
 * 503 is the opposite of backing off; and it is the small delays that matter, because that is where
 * a synchronised client fleet does its damage. The random half is what stops every device that lost
 * connectivity in the same tunnel from retrying in the same millisecond.
 */
export function retryDelay(failureCount: number, error: unknown): number {
  const appError = toAppError(error);

  // The server named a duration. Nothing this function computes is better information than that.
  if (isRateLimited(appError)) return appError.retryAfterSeconds * MILLISECONDS_PER_SECOND;

  const exponential = BASE_RETRY_DELAY_MS * 2 ** (failureCount - 1);
  const capped = Math.min(exponential, MAX_RETRY_DELAY_MS);

  return capped / 2 + Math.random() * (capped / 2);
}

/**
 * Logged once per operation, after retries are exhausted — not once per attempt.
 *
 * The level comes from `reportable`, so the split is the one `app-error.ts` already decided:
 * offline, denied, absent and rate-limited are facts about the user's situation and go to `debug`;
 * anything that means the app or the backend is wrong goes to `error`, where crash reporting will
 * pick it up when a second transport is attached.
 */
function logFailure(operation: string, scope: string, error: unknown, attempts: number): void {
  const appError = toAppError(error);
  const context = { operation, scope, kind: appError.kind, code: appError.code, attempts };

  if (appError.reportable) {
    logger.error(`${operation} failed`, appError, context);
    return;
  }

  logger.debug(`${operation} failed`, context);
}

/**
 * A fresh client. The app uses the singleton below; tests and Storybook-style harnesses need their
 * own, because cache state shared between two tests is a test that passes in isolation and fails in
 * a suite.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    /**
     * The cache-level handler, rather than per-query `onError` callbacks — which v5 removed for
     * queries precisely because they fired per observer, so a list rendered in two places logged
     * its failure twice.
     */
    queryCache: new QueryCache({
      onError: (error, query) => {
        logFailure('query', describeQueryKey(query.queryKey), error, query.state.fetchFailureCount);
      },
    }),

    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // `variables` is deliberately unused. A mutation's variables are the payload — a message
        // body, a preference change, a device token — and none of that belongs in a log (§48).
        const key = mutation.options.mutationKey;

        logFailure(
          'mutation',
          key === undefined ? '(unkeyed)' : describeQueryKey(key),
          error,
          mutation.state.failureCount
        );
      },
    }),

    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay,

        /**
         * No `staleTime` or `gcTime` here, on purpose. A default would be the "one global cache
         * policy" ADR-0006 rejects, and — worse — it would be the value every query that forgot to
         * pick a tier silently inherited. Omitting them leaves TanStack's `staleTime: 0`, which
         * refetches on mount: the fail-safe direction, since the cost is a request rather than
         * stale data on screen.
         */

        /**
         * Errors render, they do not throw. A thrown query error unmounts the subtree to the
         * nearest boundary, which turns a failed notification count into a blank screen. Screens
         * branch on `error` and render `ErrorState`; a boundary is for a render bug, not for a
         * failed request.
         */
        throwOnError: false,

        /**
         * Explicit because §51 depends on it: while `onlineManager` reports offline, a query is
         * *paused* rather than attempted, so it fails no attempts, consumes no retries, and never
         * shows an error state for something a reconnect will fix. `refetchOnReconnect` (default
         * `true`) is the other half — the notification list resyncs on reconnect without a screen
         * asking it to.
         */
        networkMode: 'online',
      },

      mutations: {
        /**
         * A mutation is not retried by default, because this layer cannot know whether it is
         * idempotent: a `network` failure is indistinguishable from a request that reached the
         * server, committed, and lost its response — and retrying that one writes twice.
         *
         * The idempotent ones opt in per mutation. `mark_read` is the example: it sets a timestamp
         * that is already set, so a duplicate is free.
         */
        retry: false,
        retryDelay,
        throwOnError: false,
        networkMode: 'online',
      },
    },
  });
}

/**
 * The application's client.
 *
 * A module singleton rather than a `useState(() => createQueryClient())` in the provider, because
 * `reset.ts` has to reach it from a sign-out handler that is not inside React, and a client held in
 * component state cannot be reached from there without a second reference to keep in sync.
 */
export const queryClient = createQueryClient();

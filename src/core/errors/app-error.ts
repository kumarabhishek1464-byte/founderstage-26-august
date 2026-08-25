/**
 * The one error type the application layer ever sees.
 *
 * Everything that can fail — a PostgREST response, a thrown `TypeError` from `fetch`, a
 * Zod parse, an aborted request — is normalised into an `AppError` before it crosses out
 * of `src/core`. Screens and hooks then branch on a closed set of kinds instead of on
 * whatever shape the failure happened to arrive in.
 *
 * Two properties are load-bearing:
 *
 * 1. **`message` is for developers, `userMessage` is for users.** Raw server text lands in
 *    `message` and in logs; it must never reach the UI, because database errors leak table
 *    names, column names and constraint definitions. `userMessage` is the only field a
 *    component is allowed to render.
 * 2. **`kind` is closed.** Adding a kind is a deliberate act with a UI consequence, so the
 *    list below is short and every member exists because it drives a *different* response.
 *    A kind that behaves identically to another kind is not a kind, it is a `code`.
 */

/**
 * Declared as a tuple so the union type and the runtime list cannot drift — a
 * hand-maintained `AppErrorKind[]` beside a `type` is a bug waiting for the next kind.
 */
export const APP_ERROR_KINDS = [
  'network',
  'timeout',
  'cancelled',
  'auth',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'rate_limit',
  'server',
  'unknown',
] as const;

export type AppErrorKind = (typeof APP_ERROR_KINDS)[number];

interface KindPolicy {
  /**
   * Shown to users verbatim. Written to be true without being specific: it must not imply
   * a cause the app cannot actually distinguish, and it must not name anything internal.
   */
  readonly userMessage: string;

  /**
   * Whether retrying the *same* operation could plausibly succeed. Consumed by the query
   * layer's retry policy, so a wrong value here means either a hammered server or a
   * spinner that gives up on a transient blip.
   */
  readonly retryable: boolean;

  /**
   * Whether this should reach crash reporting. Expected failures — offline, denied, not
   * found, rate limited, cancelled — are noise: they say something about the user's
   * situation, not about a defect, and at 100k MAU they would bury the real signal and
   * exhaust the error budget. Only failures that indicate the app or the backend is wrong
   * are reported.
   */
  readonly reportable: boolean;
}

const KIND_POLICY: Readonly<Record<AppErrorKind, KindPolicy>> = {
  network: {
    userMessage: "You appear to be offline. Check your connection and we'll try again.",
    retryable: true,
    reportable: false,
  },
  timeout: {
    userMessage: 'That took longer than expected. Please try again.',
    retryable: true,
    reportable: true,
  },
  /**
   * A superseded request — the user navigated away, or a newer query replaced this one.
   * Not a failure at all. It is a kind rather than a swallowed `null` so the query layer
   * can recognise and discard it explicitly instead of rendering an error state for
   * something the user caused on purpose.
   */
  cancelled: {
    userMessage: '',
    retryable: false,
    reportable: false,
  },
  auth: {
    userMessage: 'Please sign in to continue.',
    retryable: false,
    reportable: false,
  },
  /**
   * Distinct from `auth` because the correct response is the opposite one. Sending a
   * signed-in user who lacks a role to the sign-in screen is a loop they cannot escape,
   * and it is the single most common way this distinction gets collapsed.
   */
  forbidden: {
    userMessage: "You don't have access to this.",
    retryable: false,
    reportable: false,
  },
  not_found: {
    userMessage: "This isn't available anymore.",
    retryable: false,
    reportable: false,
  },
  conflict: {
    userMessage: 'That already exists.',
    retryable: false,
    reportable: false,
  },
  validation: {
    userMessage: 'Please check the highlighted fields.',
    retryable: false,
    reportable: false,
  },
  rate_limit: {
    userMessage: 'Too many attempts. Please wait a moment and try again.',
    retryable: true,
    reportable: false,
  },
  server: {
    userMessage: 'Something went wrong on our end. Please try again.',
    retryable: true,
    reportable: true,
  },
  unknown: {
    userMessage: 'Something went wrong. Please try again.',
    retryable: true,
    reportable: true,
  },
};

export interface AppErrorOptions {
  /** Developer-facing. Goes to logs, never to the UI. May contain upstream text. */
  readonly message: string;

  /**
   * Overrides the kind's default. Use only for text that is genuinely more helpful to a
   * user, and never pass an upstream `error.message` here — that is the leak this field
   * exists to prevent.
   */
  readonly userMessage?: string;

  /** The upstream identifier, e.g. a Postgres `23505` or a PostgREST `PGRST116`. */
  readonly code?: string;

  /** Structured diagnostics. Redacted by the logger, so it may not contain a secret. */
  readonly context?: Readonly<Record<string, unknown>>;

  /** The original thrown value, preserved for logging. Never rendered. */
  readonly cause?: unknown;
}

interface RateLimitOptions extends AppErrorOptions {
  readonly retryAfterSeconds: number;
}

interface ValidationOptions extends AppErrorOptions {
  readonly fieldErrors: Readonly<Record<string, string>>;
}

export class AppError extends Error {
  override readonly name = 'AppError';

  readonly kind: AppErrorKind;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly reportable: boolean;
  readonly code: string | undefined;
  readonly context: Readonly<Record<string, unknown>> | undefined;

  /** Set only on `rate_limit`. Read it through {@link isRateLimited} to get a `number`. */
  readonly retryAfterSeconds: number | undefined;

  /** Set only on `validation`. Keyed by form field path. */
  readonly fieldErrors: Readonly<Record<string, string>> | undefined;

  constructor(kind: AppErrorKind, options: AppErrorOptions) {
    super(options.message, { cause: options.cause });

    // Babel downlevels `class` to ES5 for older browserslist targets on web, and an ES5
    // `extends` loses the prototype link — which would make `instanceof AppError` return
    // false for a genuine AppError and silently double-wrap it. One line of insurance
    // against a build-target change nobody would connect to this file.
    Object.setPrototypeOf(this, new.target.prototype);

    const policy = KIND_POLICY[kind];

    this.kind = kind;
    this.userMessage = options.userMessage ?? policy.userMessage;
    this.retryable = policy.retryable;
    this.reportable = policy.reportable;
    this.code = options.code;
    this.context = options.context;
    this.retryAfterSeconds = undefined;
    this.fieldErrors = undefined;
  }

  /**
   * A factory rather than a `kind` argument because `retryAfterSeconds` is not optional
   * here: the client's only sanctioned response to a 429 is to wait for the duration the
   * server named ([ADR-0008](../../../docs/adr/0008-rate-limiting-in-postgres.md)), and a
   * missing value would leave the retry policy guessing.
   */
  static rateLimit(options: RateLimitOptions): AppError {
    const error = new AppError('rate_limit', options);

    // Written past `readonly` deliberately, and only here. The alternative is a
    // constructor whose signature carries every kind's optional payload, which makes
    // every other construction site advertise fields it must not set.
    Object.assign(error, { retryAfterSeconds: Math.max(0, Math.ceil(options.retryAfterSeconds)) });

    return error;
  }

  /** As above: a validation error without field errors cannot drive a form. */
  static validation(options: ValidationOptions): AppError {
    const error = new AppError('validation', options);
    Object.assign(error, { fieldErrors: options.fieldErrors });
    return error;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Narrows `retryAfterSeconds` to a `number`, which is what a backoff calculation needs.
 * The field is optional on the class — encoding per-kind payloads in the type would mean
 * a union of eleven interfaces, and `instanceof Error` would no longer hold for the
 * union, which breaks `throw`, error boundaries and TanStack Query's error typing.
 * This predicate buys back the precision at the one call site that needs it.
 */
export function isRateLimited(
  error: AppError
): error is AppError & { readonly retryAfterSeconds: number } {
  return error.kind === 'rate_limit' && typeof error.retryAfterSeconds === 'number';
}

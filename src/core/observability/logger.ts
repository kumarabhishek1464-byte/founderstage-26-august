/**
 * The only sanctioned output path in the app. `no-console` is an ESLint error everywhere
 * except this directory, so every log statement passes through here and therefore through
 * {@link redactContext}.
 *
 * Deliberately not a logging library. What the app needs is level filtering, redaction, a
 * bound-context helper and a transport seam — about eighty lines. `winston` and `pino` are
 * both Node-oriented and would ship a stream implementation into a React Native bundle to
 * do less than this file does ([ADR-0002](../../../docs/adr/0002-expo-sdk-and-dependency-policy.md)
 * asks what a dependency earns).
 *
 * The transport indirection is the part that matters later: the Sentry breadcrumb adapter
 * and the test spy are both transports, so neither requires touching a call site.
 *
 * This file reads no configuration on purpose — it is a factory, and a factory that reaches
 * for `env` cannot be tested at a level it was not configured for. Composition (which level,
 * which transports) happens in `index.ts`.
 */
import { toAppError } from '@/core/errors';

import type { AppError } from '@/core/errors';
import { redactContext } from './redact';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Ranks rather than an `indexOf` on the tuple, so a comparison is a property read. The
 * logger is called on hot paths and must not be the reason a list drops a frame.
 */
const LEVEL_RANK: Readonly<Record<LogLevel, number>> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  /** Already redacted. A transport must not need to know about redaction. */
  readonly context: Readonly<Record<string, unknown>>;
  readonly error?: AppError;
  readonly timestamp: string;
}

export interface LogTransport {
  /** Used in the warning emitted when this transport throws. */
  readonly name: string;
  write(entry: LogEntry): void;
}

export interface Logger {
  trace(message: string, context?: Readonly<Record<string, unknown>>): void;
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  /**
   * `error` is `unknown` because that is what a `catch` block gives you. It is normalised
   * here, so no call site has to remember to do it.
   */
  error(message: string, error?: unknown, context?: Readonly<Record<string, unknown>>): void;
  /**
   * A logger whose entries carry `context` merged in. The point is that a module names
   * itself once instead of on every line, which is what makes filtering by module possible
   * in an aggregator later.
   */
  child(context: Readonly<Record<string, unknown>>): Logger;
}

export interface CreateLoggerOptions {
  readonly level: LogLevel;
  readonly transports: readonly LogTransport[];
  readonly baseContext?: Readonly<Record<string, unknown>>;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const { level, transports, baseContext = {} } = options;
  const threshold = LEVEL_RANK[level];

  function emit(
    entryLevel: LogLevel,
    message: string,
    context: Readonly<Record<string, unknown>> | undefined,
    error: AppError | undefined
  ): void {
    if (LEVEL_RANK[entryLevel] < threshold) return;

    const merged = context === undefined ? baseContext : { ...baseContext, ...context };

    const entry: LogEntry = {
      level: entryLevel,
      message,
      // Redacted once here rather than per transport, so a transport added later cannot
      // forget to do it and cannot see the unredacted value in the first place.
      context: redactContext(merged),
      ...(error === undefined ? {} : { error }),
      timestamp: new Date().toISOString(),
    };

    for (const transport of transports) {
      try {
        transport.write(entry);
      } catch {
        // A transport failure must never propagate. Logging is diagnostic; if it could
        // throw, every `catch` block in the app would gain a second failure mode, and the
        // most likely moment for that is while already handling an error.
      }
    }
  }

  return {
    trace: (message, context) => emit('trace', message, context, undefined),
    debug: (message, context) => emit('debug', message, context, undefined),
    info: (message, context) => emit('info', message, context, undefined),
    warn: (message, context) => emit('warn', message, context, undefined),

    error: (message, error, context) => {
      const appError = error === undefined ? undefined : toAppError(error);

      // The error's own context is merged *under* the call site's, so an explicit value at
      // the call site wins. Both are redacted together by `emit`.
      const combined =
        appError?.context === undefined ? context : { ...appError.context, ...(context ?? {}) };

      emit('error', message, combined, appError);
    },

    child: (context) =>
      createLogger({ level, transports, baseContext: { ...baseContext, ...context } }),
  };
}

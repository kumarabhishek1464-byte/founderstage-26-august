/**
 * Composes the application logger: this is where the level and the transport list are
 * chosen, so `logger.ts` stays a pure factory and `createLogger` remains testable at any
 * level without touching the environment.
 *
 * Import `logger` from `@/core/observability` everywhere. `no-console` makes it the only
 * option, which is the intent — a redaction pass that can be bypassed is not a control.
 */
import { logLevel } from '@/core/config/env';

import { createLogger } from './logger';
import { createConsoleTransport } from './transports/console';

export type { LogEntry, Logger, LogLevel, LogTransport, CreateLoggerOptions } from './logger';
export { createLogger, LOG_LEVELS } from './logger';
export { redact, redactContext, REDACTED } from './redact';
export { createConsoleTransport } from './transports/console';

/**
 * One transport for now. Crash reporting attaches a second one rather than replacing this,
 * because a breadcrumb trail in Sentry and a readable line in Metro are both wanted.
 *
 * `logLevel` already accounts for the environment: `debug` in development, `warn` in a
 * release build — so a production bundle evaluates and discards trace calls at the rank
 * comparison, without a per-call-site guard.
 */
export const logger = createLogger({
  level: logLevel,
  transports: [createConsoleTransport()],
});

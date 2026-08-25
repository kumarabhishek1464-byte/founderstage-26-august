/**
 * Writes to the platform console — Metro's terminal, Xcode/Logcat, or the browser devtools.
 *
 * The only transport during the foundation phase. It is not a placeholder: a console
 * transport remains correct in development forever, and the Sentry adapter will sit
 * alongside it rather than replace it.
 *
 * `no-console` is disabled for `src/core/observability/**` in eslint.config.js. This is the
 * file that exemption exists for.
 */
import type { LogEntry, LogLevel, LogTransport } from '../logger';

/**
 * `console.debug` is filtered out of the browser's default console view, which makes trace
 * output look like it vanished. `log` shows up everywhere.
 */
const CONSOLE_METHOD: Readonly<Record<LogLevel, 'log' | 'warn' | 'error'>> = {
  trace: 'log',
  debug: 'log',
  info: 'log',
  warn: 'warn',
  error: 'error',
};

const LEVEL_TAG: Readonly<Record<LogLevel, string>> = {
  trace: 'TRACE',
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

interface ConsoleTransportOptions {
  /**
   * Include the ISO timestamp in the printed line. Off by default: Metro and the browser
   * console both timestamp their own output, so printing a second one just consumes width.
   * Worth turning on when logs are being copied out of a device.
   */
  readonly withTimestamp?: boolean;
}

export function createConsoleTransport(options: ConsoleTransportOptions = {}): LogTransport {
  const { withTimestamp = false } = options;

  return {
    name: 'console',

    write(entry: LogEntry): void {
      const prefix = withTimestamp
        ? `${entry.timestamp} ${LEVEL_TAG[entry.level]}`
        : LEVEL_TAG[entry.level];

      const parts: unknown[] = [`${prefix} ${entry.message}`];

      if (Object.keys(entry.context).length > 0) parts.push(entry.context);

      if (entry.error !== undefined) {
        // The kind and code are the fields worth seeing at a glance; the error object
        // follows so devtools can expand the stack and the `cause` chain.
        parts.push({ kind: entry.error.kind, code: entry.error.code }, entry.error);
      }

      // Permitted here by the `src/core/observability/**` override in eslint.config.js —
      // no inline directive needed, and adding one would report as unused.
      console[CONSOLE_METHOD[entry.level]](...parts);
    },
  };
}

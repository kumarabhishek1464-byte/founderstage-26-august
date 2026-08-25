/**
 * The assertion that carries the most weight here is that a transport never sees an
 * unredacted context. Redaction happens once, in `emit`, precisely so that a transport
 * added later — a Sentry breadcrumb adapter, a file sink — cannot forget to do it and has
 * no opportunity to read the raw value.
 */
import { REDACTED } from '../redact';
import { createLogger } from '../logger';

import type { LogEntry, LogLevel, LogTransport } from '../logger';

function createSpyTransport(): LogTransport & { readonly entries: LogEntry[] } {
  const entries: LogEntry[] = [];

  return {
    name: 'spy',
    entries,
    write(entry) {
      entries.push(entry);
    },
  };
}

function loggerWithSpy(level: LogLevel = 'trace') {
  const spy = createSpyTransport();
  return { spy, logger: createLogger({ level, transports: [spy] }) };
}

describe('createLogger', () => {
  describe('level filtering', () => {
    it('emits everything at trace', () => {
      const { spy, logger } = loggerWithSpy('trace');

      logger.trace('a');
      logger.debug('b');
      logger.info('c');
      logger.warn('d');
      logger.error('e');

      expect(spy.entries.map((entry) => entry.level)).toEqual([
        'trace',
        'debug',
        'info',
        'warn',
        'error',
      ]);
    });

    it('drops everything below the configured level', () => {
      const { spy, logger } = loggerWithSpy('warn');

      logger.trace('a');
      logger.debug('b');
      logger.info('c');
      logger.warn('d');
      logger.error('e');

      expect(spy.entries.map((entry) => entry.level)).toEqual(['warn', 'error']);
    });

    // A production bundle runs at `warn`, so the cost of a debug call on a hot path has to
    // be a rank comparison and nothing else — no redaction pass, no timestamp, no object.
    it('does not build an entry for a suppressed level', () => {
      const transport: LogTransport = { name: 'strict', write: jest.fn() };
      const logger = createLogger({ level: 'error', transports: [transport] });

      logger.debug('expensive', { password: 'hunter2' });

      expect(transport.write).not.toHaveBeenCalled();
    });
  });

  describe('redaction', () => {
    it('redacts context before any transport sees it', () => {
      const { spy, logger } = loggerWithSpy();

      logger.info('signing in', { email: 'ada@example.com', password: 'hunter2' });

      expect(spy.entries[0]?.context).toEqual({ email: 'ada@example.com', password: REDACTED });
    });

    it('redacts context merged in from a child logger', () => {
      const { spy, logger } = loggerWithSpy();

      logger.child({ access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig' }).info('x');

      expect(spy.entries[0]?.context).toEqual({ access_token: REDACTED });
    });

    it('redacts context carried on the error itself', () => {
      const { spy, logger } = loggerWithSpy();
      const failure = new Error('nope');

      logger.error('failed', failure, { refreshToken: 'secret-value' });

      expect(spy.entries[0]?.context).toEqual({ refreshToken: REDACTED });
    });
  });

  describe('error handling', () => {
    it('normalises an unknown thrown value into an AppError', () => {
      const { spy, logger } = loggerWithSpy();

      logger.error('failed', 'a thrown string');

      expect(spy.entries[0]?.error?.kind).toBe('unknown');
      expect(spy.entries[0]?.error?.message).toBe('a thrown string');
    });

    it('classifies a network failure rather than logging it as unknown', () => {
      const { spy, logger } = loggerWithSpy();

      logger.error('load failed', new TypeError('Network request failed'));

      expect(spy.entries[0]?.error?.kind).toBe('network');
      expect(spy.entries[0]?.error?.reportable).toBe(false);
    });

    it('omits the error field when none was passed', () => {
      const { spy, logger } = loggerWithSpy();

      logger.error('just a message');

      expect(spy.entries[0]?.error).toBeUndefined();
    });

    /**
     * A logger that can throw would add a second failure mode to every `catch` block in the
     * app, and the most likely moment for a transport to fail is while already handling an
     * error. This is the test that makes that guarantee real.
     */
    it('swallows a transport failure instead of propagating it', () => {
      const hostile: LogTransport = {
        name: 'hostile',
        write() {
          throw new Error('transport is down');
        },
      };

      const logger = createLogger({ level: 'trace', transports: [hostile] });

      expect(() => logger.info('still fine')).not.toThrow();
    });

    it('still writes to the remaining transports when one throws', () => {
      const hostile: LogTransport = {
        name: 'hostile',
        write() {
          throw new Error('transport is down');
        },
      };
      const spy = createSpyTransport();

      createLogger({ level: 'trace', transports: [hostile, spy] }).info('reached');

      expect(spy.entries).toHaveLength(1);
    });
  });

  describe('child loggers', () => {
    it('merges bound context into every entry', () => {
      const { spy, logger } = loggerWithSpy();

      logger.child({ module: 'account' }).info('loaded', { durationMs: 12 });

      expect(spy.entries[0]?.context).toEqual({ module: 'account', durationMs: 12 });
    });

    // Otherwise a bound value could never be overridden for a single line, which is exactly
    // when you want to.
    it('lets call-site context win over bound context', () => {
      const { spy, logger } = loggerWithSpy();

      logger.child({ module: 'account' }).info('x', { module: 'account.avatar' });

      expect(spy.entries[0]?.context).toEqual({ module: 'account.avatar' });
    });

    it('nests', () => {
      const { spy, logger } = loggerWithSpy();

      logger.child({ a: 1 }).child({ b: 2 }).info('x');

      expect(spy.entries[0]?.context).toEqual({ a: 1, b: 2 });
    });

    it('does not leak child context back into the parent', () => {
      const { spy, logger } = loggerWithSpy();

      logger.child({ module: 'account' }).info('child');
      logger.info('parent');

      expect(spy.entries[1]?.context).toEqual({});
    });

    it('inherits the level', () => {
      const { spy, logger } = loggerWithSpy('warn');

      logger.child({ a: 1 }).debug('suppressed');

      expect(spy.entries).toHaveLength(0);
    });
  });

  it('stamps an ISO timestamp', () => {
    const { spy, logger } = loggerWithSpy();

    logger.info('x');

    expect(spy.entries[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('writes to every transport', () => {
    const first = createSpyTransport();
    const second = createSpyTransport();

    createLogger({ level: 'trace', transports: [first, second] }).info('x');

    expect(first.entries).toHaveLength(1);
    expect(second.entries).toHaveLength(1);
  });

  it('tolerates having no transports at all', () => {
    expect(() => createLogger({ level: 'trace', transports: [] }).info('x')).not.toThrow();
  });
});

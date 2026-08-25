/**
 * `toAppError` is total, so the tests are mostly about the ugly inputs: a thrown string, a
 * thrown number, a circular object, an object whose `toJSON` throws. Each of those is a
 * real thing that reaches a `catch` block, and any one of them returning `undefined` or
 * throwing would replace a handled failure with an unhandled one.
 */
import { AppError } from '../app-error';
import { toAppError } from '../normalise';

describe('toAppError', () => {
  it('returns the same instance for an AppError, so wrapping is idempotent', () => {
    const original = AppError.rateLimit({ message: '429', retryAfterSeconds: 5 });

    // Identity, not equality: re-wrapping would discard `retryAfterSeconds` and downgrade
    // the kind to `unknown`, which is how a rate-limit backoff silently stops working.
    expect(toAppError(original)).toBe(original);
  });

  describe('platform failure shapes', () => {
    it('maps an aborted request to `cancelled`', () => {
      const abort = new Error('The operation was aborted');
      abort.name = 'AbortError';

      const error = toAppError(abort);

      expect(error.kind).toBe('cancelled');
      expect(error.reportable).toBe(false);
      expect(error.userMessage).toBe('');
    });

    it('maps an AbortSignal.timeout rejection to `timeout`', () => {
      const timeout = new Error('signal timed out');
      timeout.name = 'TimeoutError';

      expect(toAppError(timeout).kind).toBe('timeout');
    });

    /**
     * The single most common runtime failure in the app, and every engine words it
     * differently. Getting any of these wrong shows "Something went wrong" to a user whose
     * wifi dropped, and reports it to Sentry as a defect.
     */
    it.each([
      ['React Native', 'Network request failed'],
      ['Chrome', 'Failed to fetch'],
      ['Firefox', 'NetworkError when attempting to fetch resource.'],
      ['Safari', 'Load failed'],
      ['Chrome offline', 'net::ERR_INTERNET_DISCONNECTED'],
    ])('maps a %s fetch rejection to `network`', (_engine, message) => {
      const error = toAppError(new TypeError(message));

      expect(error.kind).toBe('network');
      expect(error.retryable).toBe(true);
      expect(error.reportable).toBe(false);
    });

    it('is case-insensitive about the engine wording', () => {
      expect(toAppError(new TypeError('NETWORK REQUEST FAILED')).kind).toBe('network');
    });
  });

  describe('the security invariant', () => {
    /**
     * The reason `toAppError` does not use the incoming message as `userMessage`. A raw
     * Postgres error names the table, the column and the constraint; a raw PostgREST error
     * can echo the query. Neither may reach a screen.
     */
    it('never promotes an upstream message into userMessage', () => {
      const leaky = new Error(
        'duplicate key value violates unique constraint "profiles_handle_key" DETAIL: Key (handle)=(ada) already exists.'
      );

      const error = toAppError(leaky);

      expect(error.message).toContain('profiles_handle_key');
      expect(error.userMessage).not.toContain('profiles_handle_key');
      expect(error.userMessage).not.toContain('handle');
      expect(error.userMessage).not.toContain('ada');
    });
  });

  describe('unclassified values', () => {
    it('wraps a plain Error as `unknown`, preserving message and cause', () => {
      const original = new Error('something specific');
      const error = toAppError(original);

      expect(error.kind).toBe('unknown');
      expect(error.message).toBe('something specific');
      expect(error.cause).toBe(original);
    });

    it('keeps an Error subclass name as the code for diagnosis', () => {
      expect(toAppError(new TypeError('not a function')).code).toBe('TypeError');
    });

    it('uses the constructor name when an Error has no message', () => {
      expect(toAppError(new RangeError()).message).toBe('RangeError');
    });

    it('keeps a thrown string verbatim — usually the only clue to its origin', () => {
      const error = toAppError('legacy module said no');

      expect(error.kind).toBe('unknown');
      expect(error.message).toBe('legacy module said no');
    });

    it('reads a message off a non-Error object, as native modules produce', () => {
      const error = toAppError({ message: 'native bridge rejected', name: 'BridgeError' });

      expect(error.message).toBe('native bridge rejected');
      expect(error.code).toBe('BridgeError');
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a number', 42],
      ['false', false],
      ['an empty object', {}],
      ['an array', [1, 2]],
      ['a symbol', Symbol('nope')],
    ])('produces an AppError for %s rather than throwing', (_label, value) => {
      const error = toAppError(value);

      expect(error).toBeInstanceOf(AppError);
      expect(error.kind).toBe('unknown');
      expect(error.message.length).toBeGreaterThan(0);
    });

    it('survives a circular object', () => {
      const circular: Record<string, unknown> = { name: 'loop' };
      circular.self = circular;

      // `name` here is not a string message, so this falls through to `describeUnknown`,
      // where `JSON.stringify` throws on the cycle.
      expect(() => toAppError(circular)).not.toThrow();
      expect(toAppError(circular).kind).toBe('unknown');
    });

    it('survives a throwing toJSON', () => {
      const hostile = {
        toJSON() {
          throw new Error('no serialisation for you');
        },
      };

      expect(() => toAppError(hostile)).not.toThrow();
    });

    it('does not report `[object Object]` as the message', () => {
      // The old fallback did exactly this, which costs a log line and says nothing.
      const error = toAppError(new Map([['a', 1]]));

      expect(error.message).not.toContain('[object Object]');
      expect(error.message).toContain('Map');
    });
  });

  it('attaches call-site context', () => {
    const error = toAppError(new Error('x'), { operation: 'account.load' });

    expect(error.context).toEqual({ operation: 'account.load' });
  });

  // An empty string is falsy, and a naive `message || fallback` would swallow a name.
  it('ignores an empty message rather than treating it as present', () => {
    const error = toAppError({ message: '', name: 'Weird' });

    expect(error.message.length).toBeGreaterThan(0);
  });
});

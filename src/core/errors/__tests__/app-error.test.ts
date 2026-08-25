/**
 * The invariant these tests exist to protect is the message split: `message` is a developer
 * string that may contain upstream text, `userMessage` is the only thing a component may
 * render. A regression there is a data leak through the UI, and nothing else in the
 * toolchain can see it — the two fields have the same type.
 */
import { APP_ERROR_KINDS, AppError, isAppError, isRateLimited } from '../app-error';

describe('AppError', () => {
  it('is a real Error, so `throw`, error boundaries and TanStack Query all work', () => {
    const error = new AppError('server', { message: 'boom' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AppError');
    expect(error.message).toBe('boom');
    expect(typeof error.stack).toBe('string');
  });

  it('never derives userMessage from the developer message', () => {
    const error = new AppError('server', {
      message: 'duplicate key value violates unique constraint "profiles_handle_key"',
    });

    expect(error.userMessage).not.toContain('profiles_handle_key');
    expect(error.userMessage).not.toContain('constraint');
    expect(error.userMessage).toBe('Something went wrong on our end. Please try again.');
  });

  it('preserves the original thrown value as `cause` without exposing it', () => {
    const original = new Error('PGRST301: JWT expired');
    const error = new AppError('auth', { message: 'session rejected', cause: original });

    expect(error.cause).toBe(original);
    expect(error.userMessage).not.toContain('JWT');
  });

  it('allows an explicit userMessage override', () => {
    const error = new AppError('conflict', {
      message: '23505 on profiles_handle_key',
      userMessage: 'That handle is taken.',
    });

    expect(error.userMessage).toBe('That handle is taken.');
  });

  describe('kind policy', () => {
    /**
     * Iterated rather than spot-checked so that adding a kind without thinking about its
     * policy fails here. TypeScript guarantees a policy *exists*; only a test can say
     * whether it was considered.
     */
    it.each(APP_ERROR_KINDS)('assigns %s a complete policy', (kind) => {
      const error = new AppError(kind, { message: 'x' });

      expect(typeof error.retryable).toBe('boolean');
      expect(typeof error.reportable).toBe('boolean');
      expect(typeof error.userMessage).toBe('string');
    });

    /**
     * `cancelled` is the one kind with no user-facing copy, because it is not a failure —
     * rendering anything for it would show an error for an action the user took on purpose.
     */
    it('gives every kind except `cancelled` non-empty user copy', () => {
      for (const kind of APP_ERROR_KINDS) {
        const { userMessage } = new AppError(kind, { message: 'x' });
        if (kind === 'cancelled') {
          expect(userMessage).toBe('');
        } else {
          expect(userMessage.length).toBeGreaterThan(0);
        }
      }
    });

    /**
     * The reportability split is what keeps crash reporting usable at scale. An offline
     * user, a denied request and a superseded query are all facts about the situation, not
     * defects — reporting them would bury the failures that are.
     */
    it.each([
      'network',
      'cancelled',
      'auth',
      'forbidden',
      'not_found',
      'conflict',
      'validation',
      'rate_limit',
    ] as const)('does not report %s', (kind) => {
      expect(new AppError(kind, { message: 'x' }).reportable).toBe(false);
    });

    it.each(['server', 'unknown', 'timeout'] as const)('reports %s', (kind) => {
      expect(new AppError(kind, { message: 'x' }).reportable).toBe(true);
    });

    it('marks transient kinds retryable and deterministic ones not', () => {
      expect(new AppError('network', { message: 'x' }).retryable).toBe(true);
      expect(new AppError('server', { message: 'x' }).retryable).toBe(true);

      // Retrying these hits the same wall, and a spinner that retries a 403 four times
      // just delays the message the user needs.
      expect(new AppError('forbidden', { message: 'x' }).retryable).toBe(false);
      expect(new AppError('not_found', { message: 'x' }).retryable).toBe(false);
      expect(new AppError('validation', { message: 'x' }).retryable).toBe(false);
      expect(new AppError('cancelled', { message: 'x' }).retryable).toBe(false);
    });
  });

  describe('rateLimit', () => {
    it('carries the server-supplied delay', () => {
      const error = AppError.rateLimit({ message: '429', retryAfterSeconds: 30 });

      expect(error.kind).toBe('rate_limit');
      expect(error.retryAfterSeconds).toBe(30);
    });

    // A fractional or negative delay would produce a nonsensical backoff. Clamped rather
    // than trusted, because the value crosses a network boundary.
    it('rounds a fractional delay up and clamps a negative one to zero', () => {
      expect(AppError.rateLimit({ message: 'x', retryAfterSeconds: 1.2 }).retryAfterSeconds).toBe(
        2
      );
      expect(AppError.rateLimit({ message: 'x', retryAfterSeconds: -5 }).retryAfterSeconds).toBe(0);
    });

    it('narrows to a number through isRateLimited', () => {
      const error = AppError.rateLimit({ message: 'x', retryAfterSeconds: 10 });

      expect(isRateLimited(error)).toBe(true);
      if (isRateLimited(error)) {
        // The point of the predicate: arithmetic without a non-null assertion.
        expect(error.retryAfterSeconds * 2).toBe(20);
      }
    });

    it('does not claim rate limiting for another kind', () => {
      expect(isRateLimited(new AppError('server', { message: 'x' }))).toBe(false);
    });
  });

  describe('validation', () => {
    it('carries field errors', () => {
      const error = AppError.validation({
        message: 'zod failed',
        fieldErrors: { email: 'Enter a valid email' },
      });

      expect(error.kind).toBe('validation');
      expect(error.fieldErrors).toEqual({ email: 'Enter a valid email' });
    });

    it('leaves fieldErrors unset on other kinds', () => {
      expect(new AppError('server', { message: 'x' }).fieldErrors).toBeUndefined();
      expect(new AppError('server', { message: 'x' }).retryAfterSeconds).toBeUndefined();
    });
  });

  describe('isAppError', () => {
    it('accepts an AppError', () => {
      expect(isAppError(new AppError('unknown', { message: 'x' }))).toBe(true);
    });

    // A plain Error must not pass, or `toAppError` would return it unwrapped and every
    // consumer would read `undefined` for `kind`, `userMessage` and `retryable`.
    it.each([
      ['a plain Error', new Error('x')],
      ['a TypeError', new TypeError('x')],
      ['an AppError-shaped object', { kind: 'server', userMessage: 'x', message: 'x' }],
      ['a string', 'server'],
      ['null', null],
      ['undefined', undefined],
    ])('rejects %s', (_label, value) => {
      expect(isAppError(value)).toBe(false);
    });
  });
});

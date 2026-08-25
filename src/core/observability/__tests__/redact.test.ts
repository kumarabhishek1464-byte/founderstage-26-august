/**
 * These are the tests that stand behind "never log a credential". Two directions matter
 * equally and both are asserted:
 *
 *   under-redaction  a token reaches a log aggregator — a security incident
 *   over-redaction   `[redacted]` everywhere — the logger stops being worth calling, and
 *                    the next engineer works around it
 *
 * A suite that only asserted the first would pass against `redact = () => REDACTED`.
 */
import { REDACTED, redact, redactContext } from '../redact';

/** `{"alg":"HS256"}.{"role":"anon"}` — structurally a real JWT, signature meaningless. */
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.7WQ2LqPfake-signature';

describe('redact', () => {
  describe('by key name', () => {
    it.each([
      'password',
      'passwd',
      'passphrase',
      'accessToken',
      'access_token',
      'refresh_token',
      'refreshToken',
      'idToken',
      'authorization',
      'Authorization',
      'X-API-Key',
      'apiKey',
      'api_key',
      'privateKey',
      'clientSecret',
      'secret',
      'otp',
      'otpCode',
      'verification_code',
      'sessionId',
      'cookie',
      'Set-Cookie',
      'cardNumber',
      'cvv',
      'pin',
      'ssn',
      'service_role',
      'serviceRoleKey',
      'jwt',
      'auth',
    ])('redacts %s regardless of casing or separator', (key) => {
      expect(redact({ [key]: 'the-actual-secret' })).toEqual({ [key]: REDACTED });
    });

    /**
     * The other half of the contract. Every name here is one a denylist built carelessly
     * would swallow, and each is a field genuinely worth seeing in a log.
     */
    it.each([
      'refreshedAt',
      'isRefreshing',
      'queryKey',
      'keyboardHeight',
      'pinned',
      'spinnerVisible',
      'authorId',
      'email',
      'userId',
      'statusCode',
      'operation',
      'table',
      'durationMs',
      'retryCount',
    ])('leaves %s alone', (key) => {
      expect(redact({ [key]: 'visible' })).toEqual({ [key]: 'visible' });
    });

    /**
     * The known cost of substring matching, recorded rather than hidden: a field whose name
     * merely contains a sensitive word is redacted too. Normalisation strips `_` and `-`, so
     * `access_token` becomes `accesstoken` and there is no word boundary left to match on —
     * which means `tokenizer` cannot be distinguished from `accesstoken` by this mechanism.
     *
     * Accepted, because the failure direction is safe and these names do not occur in this
     * codebase's log context. If one ever does, rename the field rather than loosening the
     * denylist.
     */
    it.each(['tokenizer', 'passwordless', 'secretary'])(
      'over-redacts %s, and that is the accepted trade',
      (key) => {
        expect(redact({ [key]: 'visible' })).toEqual({ [key]: REDACTED });
      }
    );
  });

  describe('by value shape', () => {
    /**
     * The case key-based redaction structurally cannot catch: the field name says nothing.
     * This is how a token actually escapes — inside a logged response body.
     */
    it('redacts a JWT under an innocent key', () => {
      expect(redact({ data: JWT })).toEqual({ data: REDACTED });
    });

    it('redacts a JWT nested in an array inside an object', () => {
      expect(redact({ items: [{ value: JWT }] })).toEqual({ items: [{ value: REDACTED }] });
    });

    it.each([
      ['a Supabase secret key', 'sb_secret_abcdefghijklmnop'],
      ['a Supabase publishable key', 'sb_publishable_abcdefghijklmnop'],
      ['a Bearer header value', 'Bearer eyJhbGciOiJIUzI1NiJ9'],
      ['a lowercase bearer value', 'bearer abc123def456'],
    ])('redacts %s', (_label, value) => {
      expect(redact({ header: value })).toEqual({ header: REDACTED });
    });

    it.each([
      ['a UUID', '3f2504e0-4f89-11d3-9a0c-0305e82c3301'],
      ['a URL', 'https://abc.supabase.co/rest/v1/profiles'],
      ['an email', 'ada@example.com'],
      ['a sentence containing the word token', 'the token expired at noon'],
      ['a base64 image prefix', 'data:image/png;base64,iVBORw0KGgo='],
    ])('does not redact %s', (_label, value) => {
      expect(redact({ field: value })).toEqual({ field: value });
    });
  });

  describe('structure handling', () => {
    it('redacts through nesting', () => {
      const input = {
        session: { user: { id: 'u1', email: 'ada@example.com' }, access_token: JWT },
      };

      expect(redact(input)).toEqual({
        session: { user: { id: 'u1', email: 'ada@example.com' }, access_token: REDACTED },
      });
    });

    it('does not mutate the input', () => {
      const input = { password: 'hunter2', nested: { token: 'abc' } };
      const snapshot = JSON.parse(JSON.stringify(input));

      redact(input);

      // A diagnostic call that alters application state is a far worse bug than the one
      // redaction prevents.
      expect(input).toEqual(snapshot);
    });

    it('terminates on a circular reference instead of overflowing the stack', () => {
      const circular: Record<string, unknown> = { name: 'loop' };
      circular.self = circular;

      expect(() => redact(circular)).not.toThrow();
      expect(redact(circular)).toEqual({ name: 'loop', self: '[circular]' });
    });

    it('caps depth', () => {
      // Seven levels; MAX_DEPTH is 6.
      const deep = { a: { b: { c: { d: { e: { f: { g: 'bottom' } } } } } } };

      expect(JSON.stringify(redact(deep))).toContain('[max depth]');
      expect(JSON.stringify(redact(deep))).not.toContain('bottom');
    });

    it('truncates a long array and says how much it dropped', () => {
      const result = redact({ ids: Array.from({ length: 30 }, (_, index) => index) });

      const ids = (result as { ids: unknown[] }).ids;
      expect(ids).toHaveLength(21);
      expect(ids[20]).toBe('[+10 more]');
    });

    it('leaves a short array intact', () => {
      expect(redact({ ids: [1, 2, 3] })).toEqual({ ids: [1, 2, 3] });
    });

    /**
     * `Error` does not enumerate `message` or `stack`, so a plain entries walk returns `{}`
     * and throws away the only useful content.
     */
    it('extracts name and message from an Error', () => {
      expect(redact({ cause: new TypeError('not a function') })).toEqual({
        cause: { name: 'TypeError', message: 'not a function' },
      });
    });

    it('renders a Date as ISO rather than as an empty object', () => {
      expect(redact({ at: new Date('2026-08-24T10:00:00.000Z') })).toEqual({
        at: '2026-08-24T10:00:00.000Z',
      });
    });

    it.each([
      ['Map', new Map([['a', 1]]), '[Map size=1]'],
      ['Set', new Set([1, 2]), '[Set size=2]'],
    ])('describes a %s, which serialises to {} otherwise', (_label, value, expected) => {
      expect(redact({ collection: value })).toEqual({ collection: expected });
    });

    it('replaces a function without printing its source', () => {
      const result = redact({ callback: () => 'secret in closure' });

      expect(result).toEqual({ callback: '[function]' });
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a number', 0],
      ['false', false],
    ])('passes %s through untouched', (_label, value) => {
      expect(redact({ field: value })).toEqual({ field: value });
    });
  });

  describe('redactContext', () => {
    it('returns a record', () => {
      expect(redactContext({ a: 1, token: 'x' })).toEqual({ a: 1, token: REDACTED });
    });

    it('returns an empty record for an empty context', () => {
      expect(redactContext({})).toEqual({});
    });
  });
});

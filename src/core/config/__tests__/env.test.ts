/**
 * The environment validator is the first thing that runs and the last line of defence
 * against a misconfigured build, so the tests here are adversarial: most of them assert
 * a *rejection*. A suite that only proves a good config parses would pass against
 * `z.object({}).passthrough()`.
 */
import { parseEnv } from '../env';

/**
 * Base64url segments written as literals rather than encoded in the test, because
 * encoding them here would mean re-implementing the decoder under test and asserting
 * that a function agrees with itself.
 *
 *   HEADER            → {"alg":"HS256"}
 *   ANON_PAYLOAD      → {"role":"anon"}
 *   SERVICE_PAYLOAD   → {"role":"service_role"}
 */
const HEADER = 'eyJhbGciOiJIUzI1NiJ9';
const ANON_PAYLOAD = 'eyJyb2xlIjoiYW5vbiJ9';
const SERVICE_PAYLOAD = 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0';

const ANON_JWT = `${HEADER}.${ANON_PAYLOAD}.signature-is-never-verified`;
const SERVICE_ROLE_JWT = `${HEADER}.${SERVICE_PAYLOAD}.signature-is-never-verified`;

const VALID = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: ANON_JWT,
  EXPO_PUBLIC_ENV: 'production',
} as const;

describe('parseEnv', () => {
  it('accepts a well-formed configuration', () => {
    const env = parseEnv({ ...VALID });

    expect(env.EXPO_PUBLIC_SUPABASE_URL).toBe(VALID.EXPO_PUBLIC_SUPABASE_URL);
    expect(env.EXPO_PUBLIC_ENV).toBe('production');
  });

  describe('EXPO_PUBLIC_SUPABASE_URL', () => {
    it('rejects a missing value, naming the variable', () => {
      expect(() => parseEnv({ ...VALID, EXPO_PUBLIC_SUPABASE_URL: undefined })).toThrow(
        /EXPO_PUBLIC_SUPABASE_URL/
      );
    });

    it('rejects a value that is not a URL', () => {
      expect(() => parseEnv({ ...VALID, EXPO_PUBLIC_SUPABASE_URL: 'abcdefg.supabase.co' })).toThrow(
        /must be a full URL/
      );
    });

    // supabase-js appends paths to this value, so a trailing slash produces `//rest/v1`.
    it('rejects a trailing slash', () => {
      expect(() =>
        parseEnv({ ...VALID, EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co/' })
      ).toThrow(/must not end in a slash/);
    });
  });

  describe('EXPO_PUBLIC_SUPABASE_ANON_KEY', () => {
    it('accepts a publishable key in the newer non-JWT format', () => {
      const env = parseEnv({
        ...VALID,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
      });

      expect(env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toContain('sb_publishable_');
    });

    it('rejects a truncated value', () => {
      expect(() => parseEnv({ ...VALID, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGci' })).toThrow(
        /looks truncated/
      );
    });

    it('rejects a secret key, which has no JWT structure', () => {
      expect(() =>
        parseEnv({
          ...VALID,
          EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
        })
      ).toThrow(/sb_secret_/);
    });

    /**
     * The case the structural check cannot catch on its own: a legacy service_role key
     * is a perfectly well-formed JWT. This is the assertion that makes the `role`-claim
     * guard load-bearing — delete the guard and only this test fails.
     */
    it('rejects a structurally valid JWT carrying the service_role claim', () => {
      expect(() => parseEnv({ ...VALID, EXPO_PUBLIC_SUPABASE_ANON_KEY: SERVICE_ROLE_JWT })).toThrow(
        /service_role/
      );
    });

    it('accepts a JWT whose payload is not decodable, rather than guessing', () => {
      // `!` is outside the base64url alphabet, so the claim cannot be read. Unreadable
      // must mean "no opinion", never "reject" — otherwise a future key format that
      // happens to be undecodable would break every client at startup.
      const env = parseEnv({
        ...VALID,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: `${HEADER}.not!decodable!payload.signature`,
      });

      expect(env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toContain('not!decodable!payload');
    });
  });

  describe('defaults and derived values', () => {
    it('defaults EXPO_PUBLIC_ENV to development', () => {
      const env = parseEnv({ ...VALID, EXPO_PUBLIC_ENV: undefined });

      expect(env.EXPO_PUBLIC_ENV).toBe('development');
    });

    it('rejects an unknown environment name instead of silently defaulting', () => {
      expect(() => parseEnv({ ...VALID, EXPO_PUBLIC_ENV: 'staging' })).toThrow(/EXPO_PUBLIC_ENV/);
    });

    it('coerces EXPO_PUBLIC_ENABLE_DEV_TOOLS to a boolean, defaulting to false', () => {
      expect(parseEnv({ ...VALID }).EXPO_PUBLIC_ENABLE_DEV_TOOLS).toBe(false);
      expect(
        parseEnv({ ...VALID, EXPO_PUBLIC_ENABLE_DEV_TOOLS: 'true' }).EXPO_PUBLIC_ENABLE_DEV_TOOLS
      ).toBe(true);
    });

    // An empty string is what a `.env` file with `EXPO_PUBLIC_SENTRY_DSN=` produces.
    it('treats an empty Sentry DSN as absent rather than invalid', () => {
      expect(
        parseEnv({ ...VALID, EXPO_PUBLIC_SENTRY_DSN: '' }).EXPO_PUBLIC_SENTRY_DSN
      ).toBeUndefined();
    });

    /**
     * `KEY=` is the natural way to leave an optional variable blank in a dotenv file, and
     * it arrives as `''` rather than `undefined`, so `.optional()` / `.default()` never
     * engage. This class of bug reached a running browser before it was caught, so every
     * optional variable is asserted individually rather than by sampling one.
     */
    it.each([
      ['EXPO_PUBLIC_LOG_LEVEL', 'EXPO_PUBLIC_LOG_LEVEL'],
      ['EXPO_PUBLIC_SENTRY_DSN', 'EXPO_PUBLIC_SENTRY_DSN'],
      ['EXPO_PUBLIC_ENABLE_DEV_TOOLS', 'EXPO_PUBLIC_ENABLE_DEV_TOOLS'],
      ['EXPO_PUBLIC_ENV', 'EXPO_PUBLIC_ENV'],
    ])('treats a blank %s as unset', (_label, key) => {
      expect(() => parseEnv({ ...VALID, [key]: '' })).not.toThrow();
    });

    it('applies defaults to blank values, not just missing ones', () => {
      const env = parseEnv({ ...VALID, EXPO_PUBLIC_ENV: '', EXPO_PUBLIC_ENABLE_DEV_TOOLS: '' });

      expect(env.EXPO_PUBLIC_ENV).toBe('development');
      expect(env.EXPO_PUBLIC_ENABLE_DEV_TOOLS).toBe(false);
    });

    // Blank must not be forgiving for the two variables the app cannot run without.
    it.each(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'])(
      'still rejects a blank %s',
      (key) => {
        expect(() => parseEnv({ ...VALID, [key]: '' })).toThrow(new RegExp(key));
      }
    );
  });

  it('never echoes a value in the failure message', () => {
    const attempt = () =>
      parseEnv({
        ...VALID,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: `${HEADER}.${SERVICE_PAYLOAD}.leaked-signature-material`,
      });

    expect(attempt).toThrow();

    let message = '';
    try {
      attempt();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(message).not.toContain('leaked-signature-material');
  });
});

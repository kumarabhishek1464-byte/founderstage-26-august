/**
 * The only file in the codebase permitted to read `process.env` — enforced by
 * `no-restricted-properties` in eslint.config.js. Everything else imports `env`.
 *
 * Two reasons this matters more than it looks:
 *
 * 1. `process.env.X` is inlined by Babel at build time only for statically written
 *    member expressions. `process.env[key]` returns undefined in a release bundle.
 *    Centralising the reads means that trap exists in one file that is reviewed
 *    rather than scattered across features.
 * 2. A missing or malformed Supabase URL should fail loudly at startup with a message
 *    naming the variable, not as an opaque network error on the first query.
 */
import { z } from 'zod';

import { decodeBase64Url } from '@/core/encoding';

/**
 * The `role` claim of a Supabase JWT, or `null` if the token is not a readable JWT.
 *
 * This is **not** verification — the signature is never checked, and it must never be
 * used for an access decision. Its only job is the guard below.
 */
function readRoleClaim(token: string): string | null {
  const payloadSegment = token.split('.')[1];
  if (payloadSegment === undefined) return null;

  const payload = decodeBase64Url(payloadSegment);
  if (payload === null) return null;

  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== 'object' || parsed === null || !('role' in parsed)) return null;

    const { role } = parsed;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z
    .url({ message: 'EXPO_PUBLIC_SUPABASE_URL must be a full URL, e.g. https://xyz.supabase.co' })
    .refine((value) => !value.endsWith('/'), {
      message: 'EXPO_PUBLIC_SUPABASE_URL must not end in a slash — supabase-js appends paths.',
    }),

  /**
   * A JWT, so it has three dot-separated segments. Length-checking instead would
   * reject the new publishable-key format; structure-checking catches the actual
   * mistake, which is pasting the URL or a truncated value.
   *
   * `sb_secret_…` keys fail this check for free — they contain no dots.
   */
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'EXPO_PUBLIC_SUPABASE_ANON_KEY looks truncated.')
    .refine((value) => value.split('.').length === 3 || value.startsWith('sb_publishable_'), {
      message:
        'EXPO_PUBLIC_SUPABASE_ANON_KEY must be the anon JWT or a sb_publishable_ key. ' +
        'If it starts with `sb_secret_`, STOP — that must never reach the client.',
    })
    /**
     * The worst configuration mistake this codebase can make: `supabase start` prints
     * the anon and service_role JWTs on adjacent lines, and a legacy service_role key
     * is a structurally perfect JWT, so nothing above can tell them apart. Anything
     * with an `EXPO_PUBLIC_` prefix is inlined into the bundle and shipped to every
     * device, and service_role bypasses RLS entirely — so the claim is read and the
     * app refuses to start.
     */
    .refine((value) => readRoleClaim(value) !== 'service_role', {
      message:
        'EXPO_PUBLIC_SUPABASE_ANON_KEY carries the service_role claim. STOP — this key ' +
        'bypasses every RLS policy and would be shipped inside the client bundle. Use ' +
        'the anon / publishable key.',
    }),

  EXPO_PUBLIC_ENV: z.enum(['development', 'preview', 'production']).default('development'),

  EXPO_PUBLIC_SENTRY_DSN: z.url().optional(),

  EXPO_PUBLIC_LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).optional(),

  EXPO_PUBLIC_ENABLE_DEV_TOOLS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

/**
 * `KEY=` with nothing after it — the natural way to leave an optional variable blank in
 * a dotenv file — arrives as `''`, not `undefined`. `.optional()` and `.default()` only
 * engage on `undefined`, so without this every commented-out optional value becomes a
 * startup failure. Caught by booting the web app against a real `.env.local`, which is
 * the only place it shows up: `.env.example` has no values to leave blank.
 *
 * Blank and unset are the same thing for every variable here, so the distinction is
 * collapsed once at the boundary rather than with a `z.literal('')` union per field.
 */
function blankToUndefined<T extends Record<string, string | undefined>>(raw: T): T {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value === '' ? undefined : value])
  ) as T;
}

/**
 * Written as static member expressions so Babel's inlining actually applies. Do not
 * refactor this into a loop over key names — see the note at the top of the file.
 */
const rawEnv = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  EXPO_PUBLIC_LOG_LEVEL: process.env.EXPO_PUBLIC_LOG_LEVEL,
  EXPO_PUBLIC_ENABLE_DEV_TOOLS: process.env.EXPO_PUBLIC_ENABLE_DEV_TOOLS,
};

/**
 * Takes the raw record as a parameter rather than closing over `rawEnv` so the
 * validator is unit-testable against malformed input without module-graph resets, and
 * so a test can never accidentally depend on the developer's real `.env.local`.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(blankToUndefined(raw));

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    // Thrown at module load, so the app cannot reach a screen in a half-configured
    // state. The message names the variables and points at the template; it never
    // echoes a value, since that would put a credential in a log.
    throw new Error(
      `Invalid environment configuration:\n${detail}\n\n` +
        `Copy .env.example to .env.local and fill in the required values. ` +
        `See docs/ENVIRONMENT.md.`
    );
  }

  return result.data;
}

export const env = parseEnv(rawEnv);

export const isDevelopment = env.EXPO_PUBLIC_ENV === 'development';
export const isPreview = env.EXPO_PUBLIC_ENV === 'preview';
export const isProduction = env.EXPO_PUBLIC_ENV === 'production';

/**
 * Verbose logging in development, quiet in production. `__DEV__` is deliberately not
 * used here: a preview build is a release build, and its logs should look like
 * production's.
 */
export const logLevel = env.EXPO_PUBLIC_LOG_LEVEL ?? (isDevelopment ? 'debug' : 'warn');

export type Env = z.infer<typeof envSchema>;

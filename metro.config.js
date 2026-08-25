/**
 * `getSentryExpoConfig` is a drop-in replacement for Expo's `getDefaultConfig`. It
 * injects Debug ID generation into the bundle, which is what lets Sentry match a
 * production stack trace to the right source map. Without it, minified traces from
 * EAS builds are unreadable — the DSN alone is not enough.
 *
 * Note there is no `@/*` alias configured here. Expo's Metro resolver reads
 * `compilerOptions.paths` from tsconfig.json directly (walking the `extends` chain),
 * so the alias is defined in exactly one place. Jest does need its own mapping —
 * see `moduleNameMapper` in jest.config.js.
 */
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;

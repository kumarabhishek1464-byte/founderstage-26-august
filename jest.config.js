/**
 * Three projects, one per platform. Each resolves platform extensions independently, so a
 * `.web.ts` that stops compiling fails here rather than in a browser, and a
 * `Platform.OS === 'web'` branch is genuinely *executed* somewhere. ADR-0014.
 *
 * The web project does not render. `@testing-library/react-native` is a native-host library
 * and throws on react-native-web output, so every rendering suite is named
 * `*.test.native.tsx` — jest-expo's `testMatch` then collects it for `ios` and `android`
 * only. Web rendering is Playwright's layer. ADR-0019.
 *
 * `jest` is pinned to ^29.7.0 because jest-expo@57 depends on the 29 line
 * (`@jest/globals`, `babel-jest`, `jest-environment-jsdom` all ^29.2.1). Do not bump to
 * 30 without bumping jest-expo.
 */

/** Shared across all three platform projects. */
const shared = {
  // Metro reads `@/*` from tsconfig; Jest does not, so the alias is restated here.
  // These two must agree — a mismatch shows up as "cannot find module" in tests only.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Reanimated 4 delegates its runtime to `react-native-worklets`, whose native module cannot
  // exist under Jest. The package solves this by shipping a *resolver*, not a mock: it strips the
  // `native` platform extensions for any request touching `react-native-worklets`, so Jest picks
  // `WorkletsModule/NativeWorklets.ts` (the JS fallback) instead of `NativeWorklets.native.ts`
  // (which calls `installTurboModule()` at module scope and dies in `loadUnpackers`).
  //
  // Reanimated itself needs nothing: `IS_JEST` is true whenever `globalThis.jest` exists, which
  // routes it down the same JS path it uses on web. So the real Reanimated runs in these tests —
  // `useAnimatedStyle` computes real values — rather than a no-op mock that would let a broken
  // animation pass.
  resolver: 'react-native-worklets/jest/resolver.js',
  // `lucide-react-native` is in this allowlist because its `react-native` and `import` export
  // conditions both point at untranspiled `.mjs` (it also ships CJS, but the resolver picks the
  // react-native condition first). Two changes are needed to make that importable under Jest, and
  // neither alone is enough:
  //   1. this allowlist entry, so the file is not skipped by the ignore pattern; and
  //   2. the `.mjs` transform below — jest-expo's own transform only matches `\.[jt]sx?$`, so
  //      without it an allow-listed `.mjs` is read but never transpiled and fails on `import`.
  // Metro needs neither; it handles ESM and the export map natively. This is a Jest-only seam.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|native-base|react-native-svg|@gorhom/.*|react-native-reanimated|react-native-worklets|@shopify/flash-list|react-native-keyboard-controller|lucide-react-native)',
  ],
  // Merged with jest-expo's transform (Jest unions preset and project transforms, project keys
  // winning on conflict), so the preset's JSX and asset transformers are kept and this only adds
  // `.mjs`. `babel-jest` reads `babel.config.js`, so lucide's ESM goes through `babel-preset-expo`
  // like everything else.
  transform: {
    '^.+\\.mjs$': 'babel-jest',
  },
  clearMocks: true,
  restoreMocks: true,
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/', '/maestro/', '/e2e/'],
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    { ...shared, displayName: 'ios', preset: 'jest-expo/ios' },
    { ...shared, displayName: 'android', preset: 'jest-expo/android' },
    { ...shared, displayName: 'web', preset: 'jest-expo/web' },
  ],

  // No coverage threshold during the foundation phase — a threshold on a codebase with
  // no features drives tests written to raise a number. ADR-0014.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/core/database/types.generated.ts',
    '!src/app/**/+html.tsx',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  cacheDirectory: '<rootDir>/.jest-cache',
};

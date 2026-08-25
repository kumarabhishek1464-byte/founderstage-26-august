// Flat config. ESLint 9.39.5 — pinned by Expo's SDK 57 matrix, not by preference.
//
// This file is where CLAUDE.md's rules stop being documentation and start failing the
// build. The three that matter most:
//   1. Supabase client importable from two directories only (ADR-0011)
//   2. No raw react-native UI primitives in features (design system only)
//   3. No hardcoded colours/spacing in styles (ADR-0013)

const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const expoConfig = require('eslint-config-expo/flat');
const boundaries = require('eslint-plugin-boundaries');
const pluginQuery = require('@tanstack/eslint-plugin-query');
const prettierConfig = require('eslint-config-prettier');

/** Everything generated, built, or vendored. */
const IGNORES = [
  'node_modules/**',
  '.expo/**',
  'dist/**',
  'coverage/**',
  'android/**',
  'ios/**',
  'expo-env.d.ts',
  'src/core/database/types.generated.ts',
  'supabase/.temp/**',
  '*.log',
];

/**
 * The Supabase client is the backend seam. Two directories may import it:
 * `src/core/database/**` (which owns the client) and each feature's single
 * `api/repository.ts`. Everywhere else is an error, which is what makes the
 * repository layer load-bearing instead of optional. ADR-0011.
 */
const SUPABASE_RESTRICTION = {
  patterns: [
    {
      group: ['@supabase/supabase-js', '@supabase/*'],
      message:
        'Import the Supabase client only from src/core/database/** or a feature ' +
        'api/repository.ts. Screens and hooks go through a repository. See ADR-0011.',
    },
    {
      group: ['**/core/database/client', '**/core/database/client/*', '@/core/database/client'],
      message:
        'The Supabase client is reachable only from src/core/database/** or a feature ' +
        'api/repository.ts. See ADR-0011.',
    },
  ],
};

/**
 * Features compose design-system components. Importing `View` or `StyleSheet`
 * directly is how a design system dies: one screen at a time, each with its own
 * spacing. `Platform`, `Dimensions`, hooks and types remain available.
 */
const RN_PRIMITIVE_RESTRICTION = {
  paths: [
    {
      name: 'react-native',
      importNames: [
        'View',
        'Text',
        'Pressable',
        'TouchableOpacity',
        'TouchableHighlight',
        'TouchableWithoutFeedback',
        'Button',
        'StyleSheet',
        'TextInput',
        'Image',
        'ScrollView',
        'FlatList',
        'SectionList',
        'ActivityIndicator',
        'Switch',
        'Modal',
        'SafeAreaView',
      ],
      message:
        'Use the design system (@/core/design-system/components) instead of raw ' +
        'react-native primitives. Need something new? Extend an existing component ' +
        'with a variant — never create ButtonV2.',
    },
  ],
};

/**
 * The token modules are the design system's private input. Reading them from a screen
 * bypasses `useTheme()`, which is the one indirection a second palette would need —
 * ADR-0013 §1 shows this exact import as an error, and ADR-0018 §5 is the rule that
 * makes it one. Without it §1 described a convention while claiming enforcement.
 */
const TOKEN_RESTRICTION = {
  patterns: [
    {
      group: [
        '@/core/design-system/tokens',
        '@/core/design-system/tokens/*',
        '**/design-system/tokens',
        '**/design-system/tokens/*',
      ],
      message:
        'Do not import design tokens directly. Read them through useTheme() or ' +
        'createStyles() from @/core/design-system. See ADR-0013 and ADR-0018.',
    },
  ],
};

/** Hardcoded design values defeat the theme indirection. ADR-0013. */
const NO_HARDCODED_DESIGN_VALUES = [
  {
    selector: `Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]`,
    message:
      'No hex colour literals. Use theme tokens via useTheme() / createStyles(). See ADR-0013.',
  },
  {
    // Matches on `raw`, not `value`. esquery compares regexes against strings, and a
    // numeric literal's `value` is a number — `Literal[value=/^[0-9]+$/]` silently
    // matches nothing, which is exactly the kind of rule that looks enforced and isn't.
    //
    // `[1-9]…` deliberately permits `0` (`padding: 0` is not a token decision) while
    // catching 8, 12, 16 and friends.
    selector:
      'Property[key.name=/^(padding|paddingTop|paddingBottom|paddingLeft|paddingRight|' +
      'paddingHorizontal|paddingVertical|paddingStart|paddingEnd|margin|marginTop|' +
      'marginBottom|marginLeft|marginRight|marginHorizontal|marginVertical|marginStart|' +
      'marginEnd|gap|rowGap|columnGap|borderRadius|borderTopLeftRadius|' +
      'borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius|fontSize|' +
      'lineHeight|letterSpacing)$/] > Literal[raw=/^[1-9][0-9]*(\\.[0-9]+)?$/]',
    message:
      'No raw spacing/radius/typography numbers. Use theme.spacing, theme.radius or ' +
      'theme.typography. See ADR-0013.',
  },
];

module.exports = tseslint.config(
  { ignores: IGNORES },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...expoConfig,
  ...pluginQuery.configs['flat/recommended'],

  // ── Project-wide TypeScript rules ────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // ADR-0004. `unknown` + narrowing, always.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // A floating promise in React Native fails silently. Make it visible.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',

      // `separate-type-imports`, not inline: inline `import { type X }` leaves a
      // side-effect import behind when every specifier is a type, which
      // no-import-type-side-effects then flags. The two rules only agree on this style.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // Prefer `??` over `||` so 0 and '' survive. A real source of bugs.
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowNullableBoolean: true, allowNullableString: false, allowNumber: false },
      ],

      // The logger is the only sanctioned output path — it redacts secrets.
      'no-console': 'error',
      'no-debugger': 'error',
      'no-alert': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      curly: ['error', 'multi-line'],

      'no-restricted-imports': ['error', SUPABASE_RESTRICTION],

      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Use the HTTP client in @/core/network so retries and error normalisation apply.',
        },
      ],
    },
  },

  // ── Architectural boundaries ─────────────────────────────────────────────────
  // src/app → src/features → src/core. Core never looks upward.
  //
  // Written against eslint-plugin-boundaries v7: `boundaries/dependencies` (was
  // `element-types`), `policies` (was `rules`), object element selectors, `{{…}}`
  // templates, and `partialMatch: false` (was `mode: 'full'`).
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      // Element patterns match FOLDERS, not files — every file beneath the folder is
      // classified as that element. Writing `src/app/**/*` here matches nothing and
      // every file then reports as unknown. `partialMatch` is left at its default so
      // nested route groups like `src/app/(tabs)/index.tsx` still resolve to `app`.
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'feature', pattern: 'src/features/*', capture: ['featureName'] },
        { type: 'core', pattern: 'src/core' },
        // Shared test infrastructure (render helpers, factories). Declared as its own
        // element so `no-unknown-dependencies` can classify `@/test/...` imports, and so
        // the policy below can say what the relaxed rules cannot: nothing ships it.
        { type: 'test', pattern: 'src/test' },
      ],
    },
    rules: {
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message: '{{from.type}} is not allowed to import {{to.type}}. See CLAUDE.md.',
          policies: [
            {
              from: [{ element: { type: 'app' } }],
              allow: [
                { to: { element: { type: 'app' } } },
                { to: { element: { type: 'feature' } } },
                { to: { element: { type: 'core' } } },
              ],
            },
            {
              from: [{ element: { type: 'feature' } }],
              allow: [
                { to: { element: { type: 'core' } } },
                // A feature may only reach into itself.
                {
                  to: {
                    element: { type: 'feature', captured: { featureName: '{{from.featureName}}' } },
                  },
                },
              ],
              message:
                'Features must not import each other. Move the shared code into src/core. ' +
                'See ADR-0003.',
            },
            {
              from: [{ element: { type: 'core' } }],
              allow: [{ to: { element: { type: 'core' } } }],
              message:
                'src/core must never import from src/features or src/app — it is the ' +
                'bottom layer. Invert the dependency or move the code down.',
            },
            {
              // Test infrastructure may reach into core (to wrap components in real
              // providers) and into itself. It may not import features or app — a shared
              // helper coupled to a feature is not shared. Nothing may import *it* except
              // test files, which the boundaries rules are turned off for entirely.
              from: [{ element: { type: 'test' } }],
              allow: [{ to: { element: { type: 'core' } } }, { to: { element: { type: 'test' } } }],
              message:
                'src/test holds shared test infrastructure. It may use core, not features ' +
                'or routes.',
            },
          ],
        },
      ],
    },
  },

  // ── Feature code: thin, design-system only ───────────────────────────────────
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: RN_PRIMITIVE_RESTRICTION.paths,
          patterns: [...SUPABASE_RESTRICTION.patterns, ...TOKEN_RESTRICTION.patterns],
        },
      ],
      'no-restricted-syntax': ['error', ...NO_HARDCODED_DESIGN_VALUES],
    },
  },

  // ── The two places the Supabase client may be imported ───────────────────────
  {
    files: ['src/core/database/**/*.ts', 'src/features/*/api/repository.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // `select('*')` inflates payloads and blocks index-only scans.
  {
    files: ['src/features/*/api/repository.ts', 'src/core/database/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='select'] > Literal[value='*']",
          message: "No select('*') in repositories — name the columns you need. See CLAUDE.md.",
        },
      ],
    },
  },

  // ── The design system defines the tokens, so it may use raw values ───────────
  {
    files: ['src/core/design-system/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', SUPABASE_RESTRICTION],
      'no-restricted-syntax': 'off',
    },
  },

  // ── env.ts is the only reader of process.env ─────────────────────────────────
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/core/config/env.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'process.env is read only in src/core/config/env.ts, where it is validated ' +
            'once at startup. Import the parsed `env` object instead.',
        },
      ],
    },
  },

  // ── The logger is allowed to reach the console ───────────────────────────────
  {
    files: ['src/core/observability/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  // ── Tests ────────────────────────────────────────────────────────────────────
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
      '**/__mocks__/**/*.{ts,tsx}',
      'jest.setup.ts',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-properties': 'off',
      'boundaries/dependencies': 'off',
      'boundaries/no-unknown-files': 'off',
    },
  },

  // ── The web HTML shell ───────────────────────────────────────────────────────
  // `+html.tsx` is evaluated at build time and never mounts in the React tree, so it
  // cannot read a theme token — the white it declares has to be a literal. Structural,
  // not an oversight. ADR-0012.
  {
    files: ['src/app/+html.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // ── Root-level JS tooling (untyped, CommonJS) ────────────────────────────────
  {
    files: ['*.js', '*.cjs', '*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },

  // Must stay last: turns off everything Prettier owns.
  prettierConfig
);

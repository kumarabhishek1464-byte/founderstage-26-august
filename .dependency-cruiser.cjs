/**
 * dependency-cruiser is the second lock on the architecture.
 *
 * ESLint's boundaries plugin catches violations in files it lints. dependency-cruiser
 * walks the actual module graph, so it also catches transitive violations — the case
 * where core imports a core module that imports a feature. It also detects cycles,
 * which ESLint cannot see at all.
 *
 * Two independent tools checking the same invariant is deliberate: one of them will
 * be misconfigured at some point, and the other will notice.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-import-features',
      comment:
        'src/core is the bottom layer. If core needs something from a feature, the ' +
        'dependency is inverted — move the code into core or pass it in. See CLAUDE.md.',
      severity: 'error',
      from: { path: '^src/core' },
      to: { path: '^src/(features|app)' },
    },
    {
      name: 'core-must-not-import-routes',
      comment:
        'Navigation is a concern of the app layer. Core exposes a navigation port ' +
        'rather than reaching for expo-router itself.',
      severity: 'error',
      from: { path: '^src/core', pathNot: '^src/core/navigation' },
      to: { path: 'expo-router', dependencyTypes: ['npm'] },
    },
    {
      name: 'features-must-not-import-each-other',
      comment:
        'Cross-feature imports produce a ball of mud. Shared code belongs in src/core. ' +
        'See ADR-0003.',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/',
        pathNot: '^src/features/$1/',
      },
    },
    {
      name: 'features-must-not-import-routes',
      comment:
        'A feature that imports from src/app is coupled to the route tree and cannot be ' +
        'reused or tested in isolation.',
      severity: 'error',
      from: { path: '^src/features' },
      to: { path: '^src/app' },
    },
    {
      name: 'supabase-client-is-confined',
      comment:
        'The Supabase client is the backend portability seam. Only src/core/database/** ' +
        'and a feature api/repository.ts may import it. See ADR-0011.',
      severity: 'error',
      from: {
        pathNot: ['^src/core/database/', '^src/features/[^/]+/api/repository\\.ts$'],
      },
      // Matched against the RESOLVED path, which for an npm package is
      // `node_modules/@supabase/supabase-js/…` — not the bare specifier.
      to: { path: '^node_modules/@supabase/', dependencyTypes: ['npm'] },
    },
    {
      name: 'no-circular',
      comment:
        'A cycle means the two modules are really one module with an unclear boundary. ' +
        'Extract the shared part.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment:
        'An unreachable module is dead code. Route files, type declarations and config ' +
        'are legitimately entry points and are excluded.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '^src/app/', // Expo Router entry points — reached by the file-based router.
          '^src/test/', // Test infrastructure — imported only from test files, which are
          // excluded from the graph, so it always reads as orphaned.
          '(^|/)\\.[^/]+\\.(js|cjs|ts)$',
          '\\.(config|test|spec)\\.(js|cjs|ts|tsx)$',
          '^src/core/database/types\\.generated\\.ts$',
        ],
      },
      to: {},
    },
    {
      name: 'not-to-unresolvable',
      comment: 'A dependency that cannot be resolved will fail at runtime, not build time.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-duplicate-dep-types',
      comment: 'A package listed in more than one dependency section resolves unpredictably.',
      severity: 'warn',
      from: {},
      to: { moreThanOneDependencyType: true, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'not-to-dev-dep',
      comment:
        'Shipping code must not import a devDependency — it is absent from the production ' +
        'bundle graph and will fail on a real build.',
      severity: 'error',
      from: { path: '^src', pathNot: '\\.(test|spec)\\.(ts|tsx)$|^src/.*__tests__/|^src/test/' },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'production-must-not-import-test-utils',
      comment:
        'src/test pulls in @testing-library/react-native and faker, both devDependencies. ' +
        'An import from shipping code would bundle a test harness into the app — and, ' +
        'because Metro does not tree-shake, it would ship even if unused. Real test files ' +
        'are excluded from this graph, so they never trip this rule.',
      severity: 'error',
      from: { path: '^src', pathNot: '^src/test/' },
      to: { path: '^src/test/' },
    },
    {
      name: 'no-deprecated-core',
      comment: 'Deprecated Node core modules are not available in React Native anyway.',
      severity: 'error',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: '^(punycode|domain|constants|sys|_linklist|_stream_wrap)$',
      },
    },
  ],

  options: {
    // `doNotFollow`, NOT `exclude`. Excluding node_modules removes those modules from
    // the graph altogether, which silently disables every rule whose `to` is an npm
    // package — `supabase-client-is-confined` and `not-to-dev-dep` included. They report
    // zero violations and look like they pass. `doNotFollow` keeps the nodes so the rules
    // can match, without walking into dependency internals.
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.(test|spec)\\.(ts|tsx)$|__tests__|__mocks__' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'react-native', 'node', 'default'],
      extensions: [
        '.ts',
        '.tsx',
        '.native.ts',
        '.native.tsx',
        '.web.ts',
        '.web.tsx',
        '.ios.tsx',
        '.android.tsx',
        '.js',
        '.jsx',
        '.json',
      ],
      mainFields: ['react-native', 'browser', 'module', 'main'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};

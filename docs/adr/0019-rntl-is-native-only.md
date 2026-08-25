# ADR-0019 — Component render tests are native-only; the web Jest project covers everything that does not render

- **Status:** Accepted
- **Date:** 2026-08-24
- **Amends:** [ADR-0014](0014-testing-strategy.md) §2 ("a broken `.web.tsx` fails in CI")

## Context

[ADR-0014](0014-testing-strategy.md) §2 puts three jest-expo projects — `ios`, `android`, `web` —
behind a single claim: platform files resolve per project, so cross-platform breakage surfaces in
CI. The first eight design-system components made that claim testable, and it is **only partly
true**.

Every rendering suite passes on `ios` and `android` and fails on `web`, with two symptoms and one
cause:

```
● Text › renders its children
  Invariant Violation: Text strings must be rendered within a <Text> component.
  Detected attempt to render "Hello" string within a <div> component.

● Divider › is hidden from assistive tech on both platforms
  Invariant Violation: __fbBatchedBridgeConfig is not set, cannot invoke native modules
    at node_modules/react-native/Libraries/StyleSheet/StyleSheet.js:30:3
    at node_modules/@testing-library/react-native/src/helpers/map-props.ts:48:18
```

`@testing-library/react-native@14` is a **native-host** library, by declaration and by construction:

- Its `peerDependencies` name `react-native >= 0.78`. `react-native-web` is not among them.
- `render()` hard-codes the renderer's text invariant to the native host names —
  `textComponentTypes: ['Text', 'RCTText']` (`dist/render.js:29`). It is not an option a caller can
  pass. On web, `babel-preset-expo` rewrites our source's `react-native` imports to
  `react-native-web`, whose `Text` renders a DOM `div`, so the invariant fires on the first string.
- The same file hard-codes `RCTScrollView`, `RCTSwitch`, `Image`, `TextInput` and `Modal` for
  `isHostScrollView` / `isHostSwitch` / `isHostImage` / `isHostTextInput` / `isHostModal`
  (`dist/helpers/host-component-names.js`). Even with the text invariant defeated, `getByRole`,
  `toBeDisabled` and every ScrollView assertion would silently stop matching rather than fail loudly
  — which is worse.
- Its own `require('react-native')` is not remapped: `@react-native/jest-preset` contributes
  `'^react-native($|/.*)'` to `moduleNameMapper` **before** jest-expo's web preset adds
  `'^react-native$': 'react-native-web'`, and Jest's mapper is first-match-wins. So RNTL loads the
  real React Native inside jsdom, which is why its error _formatter_ dies on the batched bridge.

This is not a configuration mistake to be fixed. It is the boundary of the tool.

## Decision

### 1. A suite that renders is named `*.test.native.tsx`

jest-expo's `testMatch` already encodes this. Each project's platform extensions are `ios`+`native`,
`android`+`native`, and `web` alone, expanded into
`**/__tests__/**/*test${platformExtension}.[jt]s?(x)`. So `Button.test.native.tsx` is collected by
`ios` and `android` and is invisible to `web` — no `testPathIgnorePatterns` entry, no per-project
override, and the constraint is legible in the filename rather than buried in config.

Renamed accordingly: the eight component suites and `theme.test.native.tsx`.

### 2. The web project keeps every suite it can genuinely run

`env`, `app-error`, `normalise`, `logger`, `redact`, `haptics` and `use-breakpoint` — 39 suites
across the three projects, all green. This is not a consolation prize:

- `haptics` is the clearest case. Its web branch (`if (Platform.OS === 'web') return;`) is **only**
  executed by the web project, because `Platform.OS` genuinely differs per project. A mocked
  `Platform` would test the mock.
- `use-breakpoint` is the module whose behaviour matters most on web and least on native.

### 3. Web rendering divergence is Playwright's job, not Jest's

[ADR-0014](0014-testing-strategy.md) already assigns E2E web to Playwright. That is now the _only_
layer that renders through `react-native-web`, and it renders through a real browser rather than a
DOM emulation of one — which is where the divergences that matter (focus rings, hover, text
selection, scroll containers) actually live.

### 4. The trigger for adding a DOM render harness

Add `@testing-library/react` to the web project **when the first `.web.tsx` file carries logic**,
and not before. Today there are zero. Until then, a parallel harness would render the _same shared
source_ through a second renderer and assert `react-native-web`'s translation of it — that is
testing a dependency, and it is the duplicate-implementation trap [CLAUDE.md](../../CLAUDE.md) Rule
1 exists to prevent, wearing a test's clothes.

## Consequences

- `npm run verify` is green on all three projects, with the web project running 7 suites rather
  than 16. The 9 it does not run are not silently skipped — they do not exist for it, which is
  visible in their filenames.
- The honest scope of ADR-0014 §2 is: the web project polices **module resolution and platform
  branching** for non-rendering code. That is where `.web.ts` splits will actually land — storage,
  haptics, network, analytics — because those are the modules with a native module underneath.
- A component whose web rendering is broken will not fail Jest. It will fail Playwright, or a human.
  This is a real gap and it is recorded here rather than implied by a green suite.
- If RNTL gains react-native-web support, the fix is to delete the `.native` infix from nine
  filenames. Nothing else encodes this decision.

## Alternatives considered

- **Drop the web Jest project.** Removes the false confidence, and also removes the only execution
  of every `Platform.OS === 'web'` branch in the codebase. The branches are the point.
- **Reorder `moduleNameMapper` so `^react-native$` → `react-native-web` wins, and re-add
  `@react-native/jest-preset`'s setup to the web project.** Fixes the second symptom (RNTL's
  formatter) and not the first (the text invariant), because the invariant is about what our
  components render, not what RNTL imports. Half a fix that reads like a whole one.
- **Force the web project to render real React Native with `Platform.OS === 'web'`.** Would make all
  39 suites pass on all three projects. It would also mean the "web" tests never touch
  `react-native-web`, so a `.web.tsx` importing a DOM-only API would pass. A green suite that
  verifies nothing about web is worse than an absent one.
- **Snapshot the web DOM output.** Asserts `react-native-web`'s class-name generation, breaks on
  every RNW patch release, and finds no defect of ours. Already rejected in general terms by
  [ADR-0014](0014-testing-strategy.md) §4.

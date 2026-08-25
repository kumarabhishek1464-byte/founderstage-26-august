/**
 * `renderWithTheme` — render a component inside the real providers a test needs.
 *
 * Today that is `<SafeAreaProvider>` and `<ThemeProvider>`. Both throw rather than defaulting when
 * absent — `useTheme()` by design ([ADR-0018](../../docs/adr/0018-theme-contract.md) §4) and
 * `useSafeAreaInsets()` by the library's own choice — so a test that renders a design-system
 * component without this helper fails loudly. Which is the point: it can never pass against an
 * accidental default palette or silently-zero insets.
 *
 * The **real** `ThemeProvider`, not a stubbed context. A test that swaps in a fake theme is testing
 * the fake; the one line the real provider costs buys a test that exercises what ships.
 *
 * ## `render` is asynchronous
 *
 * `@testing-library/react-native@14` returns a **Promise** from `render`, and from `rerender` and
 * `unmount`, because React 19's `act` is async. So:
 *
 * ```ts
 * const view = await render(<Button label="Save" />);
 * await view.rerender(<Button label="Saved" />);
 * ```
 *
 * and a component that throws during render produces a **rejected promise**, not a synchronous
 * throw — `await expect(render(…)).rejects.toThrow()`, never `expect(() => render(…)).toThrow()`.
 * The synchronous form silently passes because the callback returns a promise instead of throwing,
 * which is the failure mode this note exists to prevent.
 *
 * ## So is `fireEvent`
 *
 * `fireEvent`, `fireEvent.press`, `.changeText` and `.scroll` also return promises in v14, for the
 * same reason. `await fireEvent.press(button)` — an unawaited press dispatches the handler but does
 * not wait for the resulting render, so any assertion about what the press *changed* races it.
 * `no-floating-promises` catches this, which is why the rule is not relaxed for test files.
 *
 * ## A suite that uses this helper must be named `*.test.native.tsx`
 *
 * `@testing-library/react-native` is a native-host library: its renderer's text invariant is
 * hard-coded to the host names `Text`/`RCTText`, and on web `babel-preset-expo` rewrites our
 * `react-native` imports to `react-native-web`, whose `Text` is a DOM `div`. Every render therefore
 * throws under the `web` Jest project. The `.native` infix is jest-expo's own mechanism for that —
 * its `testMatch` collects `*test.native.tsx` for `ios` and `android` only —
 * [ADR-0019](../../docs/adr/0019-rntl-is-native-only.md).
 *
 * As more global providers arrive (QueryClientProvider in stage 5, and so on) they are composed
 * here, so a test opts into the whole app environment through one wrapper rather than assembling it
 * each time.
 */
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/core/design-system/theme';

import type { RenderResult, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import type { Metrics } from 'react-native-safe-area-context';

/**
 * The element type RNTL's queries return, for a test that has to hold one in a variable — walking up
 * with `.parent`, or reaching a component that is deliberately unqueryable (`Divider`, `Skeleton`).
 *
 * Derived from a query rather than imported as `TestInstance` from `test-renderer`. That package is
 * RNTL 14's own renderer and a transitive dependency this project does not declare, so naming it in
 * test files would pin them to a package they cannot see in `package.json`. It is also **not**
 * `ReactTestInstance` from `@types/react-test-renderer`, which is the older renderer's incompatible
 * type — close enough to look right and missing half the methods.
 */
export type TestElement = ReturnType<typeof screen.getByTestId>;

/**
 * Safe-area metrics every test renders against. In the app the provider comes from expo-router's
 * `ExpoRoot`; there is no router in a test, and `useSafeAreaInsets()` throws rather than defaulting,
 * so the wrapper supplies one.
 *
 * The insets are deliberately **non-zero** — an iPhone-14-Pro-shaped notch and home indicator. Zero
 * insets would let a `Screen` that forgot to apply them pass every assertion, because
 * `paddingTop: 0` and "no padding" are indistinguishable. These numbers make the inset visible in
 * the rendered style, which is the only way a test can prove it was applied.
 *
 * Exported so a test can assert against the same numbers rather than restating them.
 */
export const TEST_SAFE_AREA: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function AllProviders({ children }: { readonly children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA}>
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * No options parameter. `RenderOptions` carries only `wrapper`, and the wrapper is the one thing
 * this helper exists to fix — accepting an override would reintroduce the provider-less render it
 * replaces. Per-test provider configuration (a seeded query client) will arrive as a named option
 * here when there is something to configure.
 */
export function renderWithTheme(ui: ReactElement): Promise<RenderResult> {
  return render(ui, { wrapper: AllProviders });
}

// Re-exported so a test file imports screen queries, `fireEvent`, `waitFor` and the render helper
// from one place, and never reaches for the raw `render` that skips the providers. The explicit
// export below shadows the star-exported `render`, which is what makes `import { render } from
// '@/test'` safe by default rather than by convention.
export * from '@testing-library/react-native';
export { renderWithTheme as render };

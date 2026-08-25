/**
 * The theme seam. `useTheme()` is how every component in the app reads a design value; nothing
 * outside this directory imports the token modules.
 *
 * The provider takes no props today. That is deliberate — it is a place to put the palette
 * selection, not a theme switcher built ahead of a declined feature
 * ([ADR-0013](../../../../docs/adr/0013-single-light-theme.md)). When dark mode arrives, the
 * change is a `mode` prop here and a second palette object; no component is touched.
 */
import { createContext, useContext } from 'react';

import { lightTheme } from './light';

import type { ReactNode } from 'react';
import type { Theme } from './theme';

/**
 * `undefined` rather than defaulting to `lightTheme`.
 *
 * Defaulting would make a component rendered outside the provider work by accident — identical
 * output today, and silently light-themed on the day a second palette exists. The bug would be
 * introduced now and discovered then. Throwing means every consumer is provably inside the
 * provider from the start, which is the whole value of the seam.
 *
 * The cost is that tests need a wrapper. `renderWithTheme` in `src/test/` exists for that, and a
 * test that forgets it fails loudly rather than passing against a default.
 */
const ThemeContext = createContext<Theme | undefined>(undefined);

interface ThemeProviderProps {
  readonly children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // No `useMemo`: the value is a module-level constant, so it is already referentially stable
  // across renders. Wrapping it would be ceremony that implies otherwise.
  return <ThemeContext.Provider value={lightTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);

  // A plain `Error`, not an `AppError`: this is a wiring mistake that crashes at mount during
  // development and can never reach a user, so it needs no `userMessage` and no error kind.
  if (theme === undefined) {
    throw new Error(
      'useTheme() was called outside <ThemeProvider>. Wrap the tree in AppProviders; ' +
        'in tests use renderWithTheme from @/test.'
    );
  }

  return theme;
}

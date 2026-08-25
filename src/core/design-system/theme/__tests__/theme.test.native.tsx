/**
 * The theme layer's contract, which is mostly about failure modes: what happens outside the
 * provider, and whether the per-theme style cache actually caches.
 */
import { render as renderWithoutProviders } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createStyles, lightTheme, useTheme } from '@/core/design-system/theme';
import { render, renderWithTheme, screen } from '@/test';

import type { Theme } from '@/core/design-system/theme';

/** Renders whatever the hook returns, so a test can read it out of the tree. */
function ThemeProbe({ read }: { readonly read: (theme: Theme) => string }) {
  const theme = useTheme();
  return <Text>{read(theme)}</Text>;
}

describe('useTheme', () => {
  it('supplies the light theme inside the provider', async () => {
    await renderWithTheme(<ThemeProbe read={(t) => t.colors.surface.primary} />);

    expect(screen.getByText('#FFFFFF')).toBeTruthy();
  });

  it('rejects outside the provider rather than falling back to a default palette', async () => {
    // ADR-0018 §4: defaulting to lightTheme would make this pass today and render the wrong
    // palette on the day a second theme exists. The throw is the guarantee.
    //
    // `.rejects`, not `expect(() => …).toThrow()` — RNTL 14's render is async, so the
    // synchronous form would pass without the component ever rendering.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      renderWithoutProviders(<ThemeProbe read={(t) => t.colors.surface.primary} />)
    ).rejects.toThrow(/outside <ThemeProvider>/);

    consoleError.mockRestore();
  });

  it('returns the identical object on every read, so memoised consumers hold', async () => {
    const seen: Theme[] = [];

    function Collector() {
      seen.push(useTheme());
      return null;
    }

    const view = await renderWithTheme(<Collector />);
    await view.rerender(<Collector />);

    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[0]).toBe(seen[seen.length - 1]);
    expect(seen[0]).toBe(lightTheme);
  });
});

describe('createStyles', () => {
  it('builds the sheet once for the whole app, not once per component instance', async () => {
    const factory = jest.fn((t: Theme) => ({
      card: { backgroundColor: t.colors.surface.primary },
    }));
    const useStyles = createStyles(factory);
    const sheets: unknown[] = [];

    function Card() {
      sheets.push(useStyles());
      return null;
    }

    await renderWithTheme(
      <>
        <Card />
        <Card />
        <Card />
      </>
    );

    // The cache is keyed on the theme object, so three mounts share one StyleSheet.create.
    // A per-instance `useMemo` would call the factory three times and still pass a
    // "styles are defined" assertion — which is why this asserts the call count.
    expect(factory).toHaveBeenCalledTimes(1);
    expect(sheets).toHaveLength(3);
    expect(sheets[0]).toBe(sheets[1]);
    expect(sheets[1]).toBe(sheets[2]);
  });

  it('resolves tokens through the theme rather than capturing them at module load', async () => {
    const useStyles = createStyles((t) => ({
      card: {
        borderRadius: t.radius.lg,
        padding: t.spacing.lg,
        borderWidth: t.border.hairline,
      },
    }));
    // Collected by pushing rather than assigning: `react-hooks/globals` (the React Compiler
    // rules) rejects reassigning an outer variable during render, and it is right to — the
    // array form is the same observation without the impure write.
    const resolved: Record<string, unknown>[] = [];

    function Card() {
      resolved.push(useStyles().card);
      return null;
    }

    await renderWithTheme(<Card />);

    // The design language's card: radius 16, interior padding 20, hairline border.
    expect(resolved[0]).toEqual({ borderRadius: 16, padding: 20, borderWidth: 1 });
  });
});

describe('the @/test barrel', () => {
  it('shadows the raw render, so a test cannot skip the providers by accident', async () => {
    // `export { renderWithTheme as render }` after `export *` is what makes this true. If the
    // shadowing ever stopped working, `render` here would be Testing Library's own and the
    // second assertion would reject for want of a ThemeProvider.
    expect(render).toBe(renderWithTheme);
    await expect(render(<ThemeProbe read={(t) => t.colors.text.primary} />)).resolves.toBeDefined();
  });
});

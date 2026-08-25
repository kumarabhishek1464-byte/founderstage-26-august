/**
 * `Text`'s two axes and its one non-obvious behaviour: an `overline` announces sentence-case even
 * though it renders uppercase. Colour values are not asserted for the same reason as `Button` —
 * that would test the palette against itself.
 */
import { Text } from '@/core/design-system';
import { render, screen } from '@/test';

describe('Text', () => {
  it('renders its children', async () => {
    await render(<Text>Hello</Text>);

    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('announces heading variants as headers, so users can navigate by them', async () => {
    await render(<Text variant="title1">Section</Text>);

    expect(screen.getByRole('header', { name: 'Section' })).toBeTruthy();
  });

  it('does not mark body text as a header', async () => {
    await render(<Text variant="body">Just prose</Text>);

    expect(screen.queryByRole('header')).toBeNull();
  });

  it('ranks headings, so web does not emit four competing <h1>s on one screen', async () => {
    // The rank is what `react-native-web` reads to pick the heading element; with no `aria-level` it
    // renders every `role="header"` as `<h1>`. Asserted on the prop rather than the DOM because this
    // suite is native-only (ADR-0019) — the value, not the element, is what this component owns.
    await render(
      <>
        <Text variant="title1">Screen</Text>
        <Text variant="title3">Subsection</Text>
      </>
    );

    expect(screen.getByText('Screen').props['aria-level']).toBe(1);
    expect(screen.getByText('Subsection').props['aria-level']).toBe(3);
  });

  it('leaves the rank off a non-heading, where it would mean nothing', async () => {
    await render(<Text variant="body">Just prose</Text>);

    expect(screen.getByText('Just prose').props['aria-level']).toBeUndefined();
  });

  it('keeps an overline label sentence-case even though it renders uppercase', async () => {
    // `textTransform: 'uppercase'` transforms the rendered glyphs; without an explicit label a
    // screen reader spells "N-E-W". The component passes the original string as the label.
    await render(<Text variant="overline">New</Text>);

    expect(screen.getByLabelText('New')).toBeTruthy();
  });

  it('lets an explicit accessibilityLabel win over the visible text', async () => {
    await render(<Text accessibilityLabel="1200 followers">1.2k</Text>);

    expect(screen.getByLabelText('1200 followers')).toBeTruthy();
  });

  it('passes numberOfLines through for truncation', async () => {
    await render(
      <Text numberOfLines={1}>A very long single line that should be capped and ellipsised</Text>
    );

    expect(screen.getByText(/very long single line/)).toHaveProp('numberOfLines', 1);
  });
});

/**
 * `Icon`'s contract is accessibility and sizing, not appearance: it is decorative by default, becomes
 * a single `image` element with a name when given one, and takes its square from the theme rather
 * than a literal. Which glyph renders is not asserted — that would test Lucide's SVG, not this
 * component.
 */
import { Icon } from '@/core/design-system';
import { render, screen } from '@/test';

describe('Icon', () => {
  it('is hidden from assistive tech by default — an icon beside a label duplicates it', async () => {
    await render(
      <>
        <Icon name="search" />
        <Icon name="close" accessibilityLabel="Close" />
      </>
    );

    // Exactly one image for two icons. Both halves matter: the unlabelled icon is decoration and
    // must not be announced, and the labelled one must be announced *once*. Rendering the pair
    // together is what keeps this honest — asserting `queryByRole('image')` is null against a lone
    // unlabelled icon would also pass if the role were never applied to anything.
    expect(screen.getAllByRole('image')).toHaveLength(1);
    expect(screen.getByRole('image', { name: 'Close' })).toBeTruthy();
  });

  it('resolves each size to its metrics token rather than a literal', async () => {
    await render(<Icon name="close" size="lg" accessibilityLabel="Close" />);

    // `size.iconLg` is 24. Asserted on both axes because an icon is a square and a component that
    // set only one would render a stretched glyph.
    const icon = screen.getByRole('image', { name: 'Close' });
    expect(icon).toHaveProp('width', 24);
    expect(icon).toHaveProp('height', 24);
  });

  it('defaults to the medium square', async () => {
    await render(<Icon name="close" accessibilityLabel="Close" />);

    expect(screen.getByRole('image', { name: 'Close' })).toHaveProp('width', 20);
  });
});

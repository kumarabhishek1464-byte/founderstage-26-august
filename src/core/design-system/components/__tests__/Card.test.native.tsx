/**
 * `Card`'s contract is that its semantics follow its handler: with `onPress` it is a button, without
 * it, it is not in the accessibility tree at all. The visual identity — white, hairline border,
 * radius 16 — is asserted only where it is load-bearing (the radius and the border carry the look and
 * are the values a feature would otherwise re-invent).
 */
import { Card, Text } from '@/core/design-system';
import { lightTheme } from '@/core/design-system/theme';
import { fireEvent, render, screen } from '@/test';

describe('Card', () => {
  it('is not a button when it has no handler', async () => {
    await render(
      <Card>
        <Text>Static content</Text>
      </Card>
    );

    // A card that looks pressable and announces nothing is the failure mode this guards; the
    // converse — announcing a button that does nothing — is equally wrong, so the role must be
    // absent when there is no handler to back it.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('becomes a button when given a handler, with the supplied name', async () => {
    await render(
      <Card onPress={jest.fn()} accessibilityLabel="Open profile">
        <Text>Ada Lovelace</Text>
        <Text>Founder</Text>
      </Card>
    );

    // The explicit label matters here: without it a screen reader reads every text node in the card
    // as one run ("Ada Lovelace Founder"), which is why the prop exists.
    expect(screen.getByRole('button', { name: 'Open profile' })).toBeTruthy();
  });

  it('calls onPress once per press', async () => {
    const onPress = jest.fn();
    await render(
      <Card onPress={onPress} accessibilityLabel="Open">
        <Text>Row</Text>
      </Card>
    );

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('carries the signature surface — white, hairline border, card radius', async () => {
    await render(
      <Card onPress={jest.fn()} accessibilityLabel="Open">
        <Text>Row</Text>
      </Card>
    );

    // `radius.lg` (16) and `border.subtle` (#EAEAEA) are the two values that carry the most of the
    // visual identity, which is exactly why they are not props.
    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: lightTheme.colors.surface.primary,
      borderColor: lightTheme.colors.border.subtle,
      borderWidth: lightTheme.border.hairline,
      borderRadius: lightTheme.radius.lg,
    });
  });

  it('clips its children to the card radius', async () => {
    await render(
      <Card padding="none">
        <Text>Full bleed</Text>
      </Card>
    );

    // Without `overflow: hidden`, an image in a `padding="none"` card renders square corners over
    // the rounded border — the most common way a card looks broken.
    expect(screen.getByText('Full bleed').parent).toHaveStyle({ overflow: 'hidden' });
  });

  it('defaults to the card padding token and honours the other two', async () => {
    await render(
      <Card>
        <Text>Default</Text>
      </Card>
    );
    expect(screen.getByText('Default').parent).toHaveStyle({ padding: lightTheme.spacing.lg });

    await render(
      <Card padding="md">
        <Text>Dense</Text>
      </Card>
    );
    expect(screen.getByText('Dense').parent).toHaveStyle({ padding: lightTheme.spacing.md });

    await render(
      <Card padding="none">
        <Text>Bleed</Text>
      </Card>
    );
    // `none` means no padding at all, not `padding: 0` layered over a default — a card whose child
    // owns its own inset.
    expect(screen.getByText('Bleed').parent).not.toHaveStyle({ padding: lightTheme.spacing.lg });
  });

  it('exposes a hint separately from the name', async () => {
    await render(
      <Card onPress={jest.fn()} accessibilityLabel="Draft" accessibilityHint="Opens the editor">
        <Text>Draft</Text>
      </Card>
    );

    expect(screen.getByRole('button')).toHaveProp('accessibilityHint', 'Opens the editor');
  });
});

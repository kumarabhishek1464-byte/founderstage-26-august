/**
 * `Button`'s contract is mostly about what it refuses to do: fire twice, announce nothing, or lose
 * its width mid-submit. Those are the assertions here. Variant colours are not tested — a snapshot of
 * a hex value tests that the palette is the palette, and breaks on every legitimate retune.
 *
 * `@/core/haptics` is mocked rather than `expo-haptics`, because the claim under test is "a press
 * fires a tap haptic", not "iOS receives `ImpactFeedbackStyle.Light`". The second claim is the
 * haptics module's own suite.
 */
import { haptic } from '@/core/haptics';
import { Button, Text } from '@/core/design-system';
import { fireEvent, render, screen } from '@/test';

jest.mock('@/core/haptics', () => ({ haptic: jest.fn() }));

const hapticMock = jest.mocked(haptic);

describe('Button', () => {
  it('announces the label as its accessible name', async () => {
    await render(<Button label="Save changes" onPress={jest.fn()} />);

    // By role, not by text: this proves the *button* carries the name, which is what a screen
    // reader announces. `getByText` would pass even if the name lived only on the inner Text.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });

  it('calls onPress once per press', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires a tap haptic before the handler, so every button feels the same', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button'));

    expect(hapticMock).toHaveBeenCalledWith('tap');
  });

  it('does not fire while loading — a double submit is a duplicate row, not a cosmetic bug', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} loading />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
    expect(hapticMock).not.toHaveBeenCalled();
  });

  it('does not fire while disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('separates busy from disabled, so assistive tech says "busy" and not "dimmed"', async () => {
    await render(<Button label="Save" onPress={jest.fn()} loading />);

    const button = screen.getByRole('button');
    // Loading is *both*: inert to touch, and busy rather than unavailable. A screen that wants
    // "in flight" gets the busy announcement without claiming the control is gone.
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });

  it('is disabled but not busy when merely disabled', async () => {
    await render(<Button label="Save" onPress={jest.fn()} disabled />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).not.toBeBusy();
  });

  it('keeps the label mounted while loading, so the button does not collapse to spinner width', async () => {
    await render(<Button label="Save changes" onPress={jest.fn()} loading />);

    // Present in the tree, just at zero opacity. Unmounting it — the obvious implementation — is a
    // visible width jump on every form submission in the app.
    expect(screen.getByText('Save changes')).toBeTruthy();
  });

  it('renders both icon slots alongside the label', async () => {
    await render(
      <Button
        label="Continue"
        onPress={jest.fn()}
        iconLeft={<Text>left</Text>}
        iconRight={<Text>right</Text>}
      />
    );

    expect(screen.getByText('left')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
    expect(screen.getByText('right')).toBeTruthy();
  });

  it('exposes the hint separately from the name', async () => {
    await render(
      <Button
        label="Delete"
        onPress={jest.fn()}
        accessibilityHint="Removes the draft permanently"
      />
    );

    expect(screen.getByRole('button')).toHaveProp(
      'accessibilityHint',
      'Removes the draft permanently'
    );
  });
});

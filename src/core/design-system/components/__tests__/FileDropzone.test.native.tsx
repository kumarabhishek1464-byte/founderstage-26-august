/**
 * `FileDropzone`'s contract is almost entirely about honesty. It ships **inert** — there is no storage
 * bucket and no server-side MIME-and-size validation, which CLAUDE.md requires before anything is
 * uploaded — so the assertions that matter are the ones proving the zone cannot be pressed while it is
 * still announced and still visible. A component that quietly became pressable without a repository
 * behind it would let a user pick a file that goes nowhere, and that is the regression this suite exists
 * to catch.
 *
 * The other half is the swap: once there is a filename, the dashed invitation is replaced by the file's
 * name and a control to clear it. Both states are tested through the accessibility tree rather than
 * through styles, because "the user can act on this" is the claim, not "the border is dashed".
 *
 * `@/core/haptics` is mocked for the same reason `Button`'s suite mocks it — the claim under test is
 * "a press fires a tap", not what iOS does with it.
 */
import { haptic } from '@/core/haptics';
import { FileDropzone } from '@/core/design-system';
import { lightTheme } from '@/core/design-system/theme';
import { fireEvent, render, screen } from '@/test';

jest.mock('@/core/haptics', () => ({ haptic: jest.fn() }));

const hapticMock = jest.mocked(haptic);

const LABEL = 'Upload proof';
const HINT = 'PDF, PPT, DOC, PNG or JPG. Max 10 MB.';

describe('FileDropzone', () => {
  it('announces the label as the zone name and the hint as its hint', async () => {
    await render(<FileDropzone label={LABEL} hint={HINT} onPress={jest.fn()} />);

    // The name is on the *control*, not only on the label row above it — a screen reader landing on
    // the zone has to hear what is being asked for, not just "button".
    const zone = screen.getByRole('button', { name: LABEL });
    // The constraints ride as the hint, so they are announced after the name rather than becoming
    // part of it. `accessibilityHint` is the only place they can go without renaming the control.
    expect(zone).toHaveProp('accessibilityHint', HINT);
  });

  it('prints the label once, so the field label and the zone do not read as a rendering bug', async () => {
    await render(<FileDropzone label={LABEL} hint={HINT} onPress={jest.fn()} />);

    // The label row owns the ask and the zone owns the answer to it. Repeating `label` inside the
    // dashes — the obvious composition — puts the same three words a hundred points apart, one
    // directly under the other.
    expect(screen.getAllByText(LABEL)).toHaveLength(1);
    expect(screen.getByText(HINT)).toBeTruthy();
  });

  it('is inert and unpressable without onPress — the state it ships in', async () => {
    await render(<FileDropzone label={LABEL} hint={HINT} />);

    const zone = screen.getByRole('button', { name: LABEL });
    // Disabled rather than absent: the field is part of the design and "optional" is honest about it.
    // What must not happen is a picker opening onto a seam that does not exist yet.
    expect(zone).toBeDisabled();
    await fireEvent.press(zone);
    expect(hapticMock).not.toHaveBeenCalled();
  });

  it('stays visible while inert, dimmed rather than hidden', async () => {
    await render(<FileDropzone label={LABEL} hint={HINT} />);

    // The disabled opacity token, not a literal and not `display: none`. A user has to be able to see
    // that the field exists and that it is not available, which is a different statement from the
    // field being absent.
    expect(screen.getByRole('button', { name: LABEL })).toHaveStyle({
      opacity: lightTheme.opacity.disabled,
    });
  });

  it('hides the Browse pill while inert, because there is nothing to browse', async () => {
    await render(<FileDropzone label={LABEL} hint={HINT} />);
    expect(screen.queryByText('Browse')).toBeNull();

    await render(<FileDropzone label={LABEL} hint={HINT} onPress={jest.fn()} />);
    // Rendering the pair in one test is what keeps this honest: asserting the pill is absent when
    // inert would also pass if the pill were never rendered at all.
    expect(screen.getByText('Browse')).toBeTruthy();
  });

  it('calls onPress once per press, after a tap haptic', async () => {
    const onPress = jest.fn();
    await render(<FileDropzone label={LABEL} hint={HINT} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: LABEL }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(hapticMock).toHaveBeenCalledWith('tap');
  });

  it('replaces the zone with the filename once there is a file', async () => {
    await render(
      <FileDropzone label={LABEL} hint={HINT} onPress={jest.fn()} filename="incorporation.pdf" />
    );

    expect(screen.getByText('incorporation.pdf')).toBeTruthy();
    // The dashes were the invitation. With a file present the component's job is to name it, so the
    // hint and the pill go — leaving them would ask again for something already given.
    expect(screen.queryByText(HINT)).toBeNull();
    expect(screen.queryByText('Browse')).toBeNull();
  });

  it('offers a named remove control only when onRemove is supplied', async () => {
    const onRemove = jest.fn();
    await render(
      <FileDropzone
        label={LABEL}
        hint={HINT}
        onPress={jest.fn()}
        filename="deck.pdf"
        onRemove={onRemove}
      />
    );

    // Named with the filename, not "Remove": a screen with two attachments would otherwise offer
    // two identical controls and no way to tell which one clears which file.
    await fireEvent.press(screen.getByRole('button', { name: 'Remove deck.pdf' }));
    expect(onRemove).toHaveBeenCalledTimes(1);

    await render(
      <FileDropzone label={LABEL} hint={HINT} onPress={jest.fn()} filename="deck.pdf" />
    );
    expect(screen.queryByRole('button', { name: 'Remove deck.pdf' })).toBeNull();
  });

  it('treats an empty filename as no file', async () => {
    await render(<FileDropzone label={LABEL} hint={HINT} onPress={jest.fn()} filename="" />);

    // An empty string is what a cleared form field holds, and it must not render as a file named
    // nothing — the zone has to come back.
    expect(screen.getByText(HINT)).toBeTruthy();
  });

  it('replaces the hint with the error when invalid, so the reason is what gets announced', async () => {
    await render(
      <FileDropzone
        label={LABEL}
        hint={HINT}
        onPress={jest.fn()}
        error="That file is over 10 MB."
      />
    );

    const zone = screen.getByRole('button', { name: LABEL });
    // The error takes the hint slot rather than being appended to it: a screen reader that reads the
    // constraints and then the failure buries the failure, and the constraints are visible on screen
    // anyway.
    expect(zone).toHaveProp('accessibilityHint', 'That file is over 10 MB.');
    expect(screen.getByText('That file is over 10 MB.')).toBeTruthy();
    expect(zone).toHaveStyle({ borderColor: lightTheme.colors.status.error });
  });

  it('ignores an empty error string', async () => {
    await render(<FileDropzone label={LABEL} hint={HINT} onPress={jest.fn()} error="" />);

    // Same reasoning as the empty filename: `''` is a resolver's "no error", not an error with no
    // text, and it must not paint the border red.
    const zone = screen.getByRole('button', { name: LABEL });
    expect(zone).toHaveProp('accessibilityHint', HINT);
    expect(zone).not.toHaveStyle({ borderColor: lightTheme.colors.status.error });
  });

  it('marks the field optional without touching the announced name', async () => {
    await render(<FileDropzone label={LABEL} hint={HINT} onPress={jest.fn()} optional />);

    expect(screen.getByText('Optional')).toBeTruthy();
    // "Optional" is a visual annotation in the label row, which is hidden from assistive tech — the
    // control's name stays the ask itself, exactly as `field.tsx` does it for a text field.
    expect(screen.getByRole('button', { name: LABEL })).toBeTruthy();
  });
});

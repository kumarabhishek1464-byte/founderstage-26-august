/**
 * `Spinner`'s two non-obvious decisions are the ones tested: the size vocabulary is two named values
 * because `ActivityIndicator` on iOS silently ignores a numeric size, and the wait is announced by
 * default so a caller cannot forget it.
 */
import { Spinner } from '@/core/design-system';
import { lightTheme } from '@/core/design-system/theme';
import { render, screen } from '@/test';

describe('Spinner', () => {
  it('announces a generic wait by default', async () => {
    await render(<Spinner />);

    // Default rather than required: an unlabelled spinner is silence during a wait, which is the
    // failure mode. A caller with better words ("Saving") overrides it.
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });

  it('takes a caller-supplied announcement', async () => {
    await render(<Spinner accessibilityLabel="Saving" />);

    expect(screen.getByLabelText('Saving')).toBeTruthy();
  });

  it('can be silenced when a parent already announces busy', async () => {
    await render(<Spinner accessibilityLabel="" />);

    // The spinner inside a loading `Button` must not announce a second time — the button is already
    // `busy`. An empty string is the explicit opt-out.
    expect(screen.queryByLabelText('Loading')).toBeNull();
  });

  it('maps its two sizes onto the platform names ActivityIndicator actually honours', async () => {
    await render(<Spinner accessibilityLabel="Loading" />);
    // `sm` is the default: a spinner is almost always inline, beside or inside a control.
    expect(screen.getByLabelText('Loading')).toHaveProp('size', 'small');

    await render(<Spinner size="md" accessibilityLabel="Loading" />);
    // Named, not numeric: iOS honours only `'small'`/`'large'` and silently ignores a number, so a
    // pixel size here would work on Android and web and do nothing on iOS.
    expect(screen.getByLabelText('Loading')).toHaveProp('size', 'large');
  });

  it('takes its colour from the tone vocabulary, not a literal', async () => {
    await render(<Spinner accessibilityLabel="Loading" />);
    // `accent` (red) on white is the default.
    expect(screen.getByLabelText('Loading')).toHaveProp('color', lightTheme.colors.text.accent);

    await render(<Spinner tone="inverse" accessibilityLabel="Loading" />);
    // `inverse` for a spinner inside a filled primary button, where accent-on-accent is invisible.
    expect(screen.getByLabelText('Loading')).toHaveProp('color', lightTheme.colors.text.inverse);
  });
});

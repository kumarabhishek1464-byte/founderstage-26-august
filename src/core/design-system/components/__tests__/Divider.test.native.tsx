/**
 * `Divider`'s reason to exist is that it is the single most likely place for a raw `#EEE` or a
 * `borderBottomWidth: 1` to appear in a feature. So the assertions are the two things that would
 * otherwise be hardcoded — the tone colour and the hairline thickness — plus its removal from the
 * accessibility tree, which a hand-rolled rule always forgets.
 */
import { View } from 'react-native';

import { Divider } from '@/core/design-system';
import { lightTheme } from '@/core/design-system/theme';
import { render, screen } from '@/test';

import type { TestElement } from '@/test';
import type { ReactElement } from 'react';

/**
 * A divider is unreachable by every accessibility query — being invisible to assistive tech is its
 * contract, not an oversight. So it is rendered inside a `testID`-bearing wrapper and read as that
 * wrapper's only child, rather than adding a `testID` prop to the component for the tests' benefit.
 */
async function renderDivider(element: ReactElement): Promise<TestElement> {
  await render(<View testID="wrap">{element}</View>);

  const [rule] = screen.getByTestId('wrap').children;
  if (rule === undefined || typeof rule === 'string') {
    throw new Error('Divider did not render a host element');
  }
  return rule;
}

describe('Divider', () => {
  it('is hidden from assistive tech on both platforms', async () => {
    const rule = await renderDivider(<Divider />);

    // A rule carries no information; left visible it inserts an empty stop between every pair of
    // rows in a screen reader's traversal. iOS reads `accessibilityElementsHidden`, Android reads
    // `importantForAccessibility` — RN does not unify them, so omitting either leaves one platform
    // announcing it.
    expect(rule).toHaveProp('accessibilityElementsHidden', true);
    expect(rule).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });

  it('renders a horizontal hairline in the subtle tone by default', async () => {
    const rule = await renderDivider(<Divider />);

    // A measured box (`height`) rather than a border, because a `borderBottomWidth` on a zero-height
    // view collapses on web. `subtle` (#EAEAEA) is the between-rows tone.
    expect(rule).toHaveStyle({
      height: lightTheme.border.hairline,
      backgroundColor: lightTheme.colors.border.subtle,
      alignSelf: 'stretch',
    });
  });

  it('uses the faint tone inside an already-bordered container', async () => {
    const rule = await renderDivider(<Divider tone="faint" />);

    // `faint` (#F0F0F0) so a divider inside a card does not read as a second frame.
    expect(rule).toHaveStyle({ backgroundColor: lightTheme.colors.border.faint });
  });

  it('becomes a vertical hairline when asked, taking width instead of height', async () => {
    const rule = await renderDivider(<Divider orientation="vertical" />);

    expect(rule).toHaveStyle({ width: lightTheme.border.hairline, alignSelf: 'stretch' });
    expect(rule).not.toHaveStyle({ height: lightTheme.border.hairline });
  });

  it('insets a horizontal rule along its length', async () => {
    const rule = await renderDivider(<Divider inset={lightTheme.spacing.md} />);

    // The inset runs along the rule, so on a horizontal divider it is horizontal margin — the way a
    // settings list indents its separators past the icon column.
    expect(rule).toHaveStyle({ marginHorizontal: lightTheme.spacing.md });
  });

  it('turns the inset to the cross axis on a vertical rule', async () => {
    const rule = await renderDivider(
      <Divider orientation="vertical" inset={lightTheme.spacing.md} />
    );

    expect(rule).toHaveStyle({ marginVertical: lightTheme.spacing.md });
  });
});

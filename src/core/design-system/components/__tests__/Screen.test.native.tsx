/**
 * `Screen`'s contract is layout that no feature should ever have to think about: the safe area, the
 * screen gutter, the surface, and the content-width clamp. Every one of those is a number that would
 * otherwise be re-decided per screen, so every one is asserted here.
 *
 * The insets come from `TEST_SAFE_AREA` rather than being restated, so a change to the test metrics
 * cannot silently make these pass against the wrong numbers.
 */
import { StyleSheet, Text as RNText } from 'react-native';

import { lightTheme } from '@/core/design-system/theme';
import { Screen } from '@/core/design-system';
import { render, screen, TEST_SAFE_AREA } from '@/test';

import type { StyleProp, ViewStyle } from 'react-native';

const { insets } = TEST_SAFE_AREA;

/**
 * `Screen` wraps its children in two Views: an outer *frame* carrying the surface and the top inset,
 * and an inner *column* carrying the gutter, the bottom inset and the width clamp. Neither takes a
 * `testID` — adding one to the component so tests can find it would put a test-only prop in the
 * public API — so they are reached by walking up from a child that does.
 */
function framing() {
  const content = screen.getByTestId('content');
  const column = content.parent;
  return { column, frame: column?.parent };
}

describe('Screen', () => {
  it('splits the safe area across the scroll boundary', async () => {
    await render(
      <Screen>
        <RNText testID="content">content</RNText>
      </Screen>
    );

    const { column, frame } = framing();
    // Top inset on the fixed frame, so a status bar never overlaps regardless of scroll position.
    expect(frame).toHaveStyle({ paddingTop: insets.top });
    // Bottom inset on the content column, so the last row clears the home indicator by scrolling
    // past it rather than being permanently pushed up.
    expect(column).toHaveStyle({ paddingBottom: insets.bottom });
  });

  it('adds the screen gutter to the horizontal insets rather than replacing them', async () => {
    await render(
      <Screen>
        <RNText testID="content">content</RNText>
      </Screen>
    );

    // `spacing.xl` (24) is the design language's screen margin. It is *added* to the inset because a
    // landscape notch and a margin are different requirements — a `max()` of the two would let a
    // 44pt sensor housing eat the entire margin.
    const gutter = lightTheme.spacing.xl;
    expect(framing().column).toHaveStyle({
      paddingLeft: insets.left + gutter,
      paddingRight: insets.right + gutter,
    });
  });

  it('clamps the content column and centres it', async () => {
    await render(
      <Screen>
        <RNText testID="content">content</RNText>
      </Screen>
    );

    // Applied on every platform, not only web: at phone width the cap is a no-op, and an Android
    // tablet or unfolded foldable needs it as much as a browser does.
    expect(framing().column).toHaveStyle({
      maxWidth: lightTheme.size.contentMaxWidth,
      alignSelf: 'center',
    });
  });

  it('paints the primary surface by default and the secondary on request', async () => {
    await render(
      <Screen>
        <RNText testID="content">content</RNText>
      </Screen>
    );
    expect(framing().frame).toHaveStyle({
      backgroundColor: lightTheme.colors.surface.primary,
    });

    await render(
      <Screen surface="secondary">
        <RNText testID="content">content</RNText>
      </Screen>
    );
    expect(framing().frame).toHaveStyle({
      backgroundColor: lightTheme.colors.surface.secondary,
    });
  });

  it('drops only the gutter when padded is false, keeping the safe area', async () => {
    await render(
      <Screen padded={false}>
        <RNText testID="content">content</RNText>
      </Screen>
    );

    const { column, frame } = framing();
    // A full-bleed screen still must not run under the notch. `padded` governs the design token, not
    // the hardware inset — conflating the two is how a full-bleed header ends up under a status bar.
    expect(column).toHaveStyle({ paddingLeft: insets.left, paddingRight: insets.right });
    expect(frame).toHaveStyle({ paddingTop: insets.top });
    expect(column).toHaveStyle({ paddingBottom: insets.bottom });
  });

  it('drops the top inset when safeTop is false, so a screen can sit under a translucent header', async () => {
    await render(
      <Screen safeTop={false}>
        <RNText testID="content">content</RNText>
      </Screen>
    );

    const { column, frame } = framing();
    expect(frame).not.toHaveStyle({ paddingTop: insets.top });
    // The bottom is independent: opting out of one edge must not opt out of the other.
    expect(column).toHaveStyle({ paddingBottom: insets.bottom });
  });

  it('drops the bottom inset when safeBottom is false', async () => {
    await render(
      <Screen safeBottom={false}>
        <RNText testID="content">content</RNText>
      </Screen>
    );

    const { column, frame } = framing();
    expect(column).toHaveStyle({ paddingBottom: 0 });
    expect(frame).toHaveStyle({ paddingTop: insets.top });
  });

  it('does not scroll by default', async () => {
    await render(
      <Screen>
        <RNText testID="content">content</RNText>
      </Screen>
    );

    // The default is the failure you can see: a screen that needed `scroll` clips visibly the first
    // time it is opened, whereas a virtualised list nested in a ScrollView recycles nothing and
    // degrades silently. So the default must render plain Views and no scroll host at all.
    expect(framing().frame?.type).toBe('View');
  });

  it('carries the gutter and the clamp onto the scroll content container when scrolling', async () => {
    await render(
      <Screen scroll>
        <RNText testID="content">content</RNText>
      </Screen>
    );

    // ScrollView renders an inner View around the children, so the scroll host is the child's
    // grandparent — and the host, not that inner View, is what carries `contentContainerStyle`.
    const scrollHost = screen.getByTestId('content').parent?.parent;
    expect(scrollHost?.type).toBe('RCTScrollView');

    // The clamp and the insets ride on the *content container*, not on the ScrollView's own style.
    // Padding applied to the ScrollView does not extend the scrollable area, so the last row would
    // stay pinned under the home indicator no matter how far the user scrolled.
    const container = StyleSheet.flatten(
      scrollHost?.props.contentContainerStyle as StyleProp<ViewStyle>
    );
    expect(container).toMatchObject({
      maxWidth: lightTheme.size.contentMaxWidth,
      alignSelf: 'center',
      paddingBottom: insets.bottom,
      paddingLeft: insets.left + lightTheme.spacing.xl,
      paddingRight: insets.right + lightTheme.spacing.xl,
      // `flexGrow`, not `flex`: a content container with `flex: 1` cannot exceed the viewport, which
      // silently disables scrolling for exactly the long content this branch exists to handle.
      flexGrow: 1,
    });
    // Taps must survive the keyboard being open, or every button under a focused field needs two
    // presses. Set here so no form has to remember it.
    expect(scrollHost).toHaveProp('keyboardShouldPersistTaps', 'handled');
  });
});

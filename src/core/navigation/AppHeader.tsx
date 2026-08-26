/**
 * `AppHeader` — the identity bar at the top of the shell.
 *
 * Rendered *outside* `Tabs` by `(tabs)/_layout.tsx`, so it does not participate in the tab transition:
 * who you are is not a per-screen fact, and animating it on every tab change would say that it is.
 *
 * ## Geometry
 *
 * ```
 * chrome   white, bottom hairline, safe-area top padding
 *   row    size.chrome (56), avatar + identity | notifications + messages
 * ```
 *
 * The row is `size.chrome` rather than a local constant, which is the same token the bottom bar uses.
 * The two bars being equal is a design decision — the canvas sits in a symmetrical frame — and 56 is
 * derived from this side too: `spacing.sm` + `avatarMd` (32) + `spacing.sm`.
 *
 * Padding is asymmetric (`md` left, `sm` right) and that is not an oversight. The left edge is a
 * 32pt circle whose ink runs to its own edge, so it needs the full margin. The right edge is a 40pt
 * `IconButton` whose glyph is 20pt centred, so it already carries 10pt of its own optical padding;
 * matching the left number would leave the bell looking inset.
 *
 * ## The badges are decorative
 *
 * The counts are `Text` layered over the button, hidden from assistive tech, because the accessible
 * name has to carry the count in a form that reads as a sentence — "Notifications, 3 unread" — rather
 * than as a stray "3" announced after the button. That is what `accessibilityLabel` below does.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, IconButton, Text } from '@/core/design-system';

import { hiddenFromAssistiveTech } from '../design-system/a11y';
import { createStyles, useTheme } from '../design-system/theme';
import { HAIRLINE_REVEAL, useHeaderScrollY } from './header-scroll';

/**
 * The signed-in founder. Hardcoded while the app is a shell — this is the seam a session/profile
 * query replaces, and keeping it as one object here is what stops the name being typed into JSX in
 * two places and then drifting.
 */
const VIEWER = {
  name: 'Abhiroy Katiyar',
  plan: 'Pro',
  online: true,
  notifications: 3,
  messages: 2,
} as const;

const useStyles = createStyles((t) => ({
  chrome: {
    backgroundColor: t.colors.surface.primary,
    // No static border. The hairline is drawn as an absolute-positioned line whose opacity is
    // driven by the scroll signal — see `hairline` below.
  },
  /**
   * The hairline that separates chrome from content. Absolute-positioned so that its opacity can
   * animate without reflowing anything above or below it, and drawn at the bottom of the chrome
   * so the transition sits exactly where a static border used to be. Height is `hairline` — 1
   * physical pixel at all densities — because a hairline that grows on a 3x device is a line, not
   * a hairline.
   */
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: t.border.hairline,
    backgroundColor: t.colors.border.subtle,
  },
  row: {
    height: t.size.chrome,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    // So a long name truncates rather than pushing the bell off the right edge.
    flexShrink: 1,
  },
  avatarWrap: { position: 'relative' },
  /**
   * The presence dot. Sized against `iconSm` (16) at three-quarters rather than a literal 12: it is a
   * mark beside a 32pt circle, and tying it to the icon scale is what keeps it proportional if that
   * scale is ever retuned. The white ring is what separates it from the avatar's own hairline.
   */
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: t.size.iconSm * 0.75,
    height: t.size.iconSm * 0.75,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.status.success,
    borderWidth: t.border.focus,
    borderColor: t.colors.surface.primary,
  },
  nameBlock: { flexShrink: 1 },
  planRow: { flexDirection: 'row', alignItems: 'center' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
  },
  badgeWrap: { position: 'relative' },
  /**
   * `minWidth` rather than `width`, so a two-digit count widens the pill instead of clipping. The
   * offsets put it over the glyph's top-right corner: the button is 40 and the glyph 20 centred, so
   * 10/10 is the corner and 4 pulls the badge just outside it.
   */
  badge: {
    position: 'absolute',
    top: t.spacing.xxs,
    right: t.spacing.xxs,
    minWidth: t.size.iconSm,
    height: t.size.iconSm,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.action.primary,
    borderWidth: t.border.focus,
    borderColor: t.colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export function AppHeader() {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  /**
   * The scroll signal that drives the hairline. Fades from invisible at the very top of a screen
   * to fully visible past `HAIRLINE_REVEAL` — the same effect a native `LargeTitle` header uses
   * to signal "there is content underneath this bar". Clamped both ways: a bouncy overscroll must
   * not push the hairline into negative opacity, and an aggressive fling must not push it above 1.
   */
  const scrollY = useHeaderScrollY();
  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HAIRLINE_REVEAL], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.chrome, { paddingTop: insets.top }]}>
      <View
        style={[
          styles.row,
          {
            paddingLeft: theme.spacing.md + insets.left,
            paddingRight: theme.spacing.sm + insets.right,
          },
        ]}
      >
        <View style={styles.identity}>
          <View style={styles.avatarWrap}>
            <Avatar size="md" name={VIEWER.name} />
            {VIEWER.online ? <View style={styles.onlineDot} /> : null}
          </View>

          <View style={styles.nameBlock}>
            <Text variant="label" tone="heading" numberOfLines={1}>
              {VIEWER.name}
            </Text>
            <View style={styles.planRow}>
              <Text variant="caption" tone="tertiary">
                {'FounderStage '}
              </Text>
              <Text variant="caption" tone="accent">
                {VIEWER.plan}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.badgeWrap}>
            <IconButton
              name="notifications"
              tone="heading"
              accessibilityLabel={`Notifications, ${String(VIEWER.notifications)} unread`}
              onPress={() => {
                router.push('/notifications');
              }}
            />
            <View style={styles.badge} {...hiddenFromAssistiveTech(true)}>
              <Text variant="overline" tone="inverse">
                {String(VIEWER.notifications)}
              </Text>
            </View>
          </View>

          <View style={styles.badgeWrap}>
            <IconButton
              name="chat"
              tone="heading"
              accessibilityLabel={`Messages, ${String(VIEWER.messages)} unread`}
              onPress={() => {
                router.push('/chat');
              }}
            />
            <View style={styles.badge} {...hiddenFromAssistiveTech(true)}>
              <Text variant="overline" tone="inverse">
                {String(VIEWER.messages)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Absolute-positioned so it does not push content, and rendered *last* so it sits above the
          chrome's background rather than being clipped by it. */}
      <Animated.View style={[styles.hairline, hairlineStyle]} pointerEvents="none" />
    </View>
  );
}

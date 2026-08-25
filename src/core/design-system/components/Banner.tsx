/**
 * `Banner` — a short block of standing information: a reassurance, a caveat, a rule.
 *
 * ## Why every tone has the same background
 *
 * The reflex is a tinted fill per tone — green for success, amber for warning, red for error. This
 * design language does not have those fills, and adding them would be the single fastest way to break
 * it: "roughly 90% of any screen is white or neutral" and "red is a signal, never a background". A
 * screen with a green panel, an amber panel and a red panel is a different product.
 *
 * So the fill is always `surface.secondary` with a hairline, and the tone is carried by the **glyph** —
 * both its shape and its colour. That satisfies WCAG 1.4.1 the same way the status icons do (a check in
 * a circle, a triangle, an exclamation), and it means a banner reads as part of the page rather than as
 * a coloured interruption in it.
 *
 * ## Why `error` and `warning` are announced as alerts
 *
 * A reassurance is prose and belongs in reading order. Something the user must act on is not: on web,
 * `role="alert"` makes a screen reader announce it as soon as it appears, which is the difference
 * between a validation summary that is heard and one that is only heard by users who happen to scroll
 * back up. The mapping is a table rather than a prop, so a caller cannot ship an error banner that stays
 * silent.
 */
import { View } from 'react-native';

import { createStyles } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import type { IconName } from './Icon';
import type { Tone } from './tone';

export type BannerTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

interface BannerProps {
  /** Defaults to `neutral` — most banners state a fact rather than a status. */
  readonly tone?: BannerTone;
  /** The sentence. Required, because a banner with only a title is a heading in a box. */
  readonly message: string;
  /** An optional lead-in above the message, for a banner carrying more than one line of consequence. */
  readonly title?: string;
  /** Overrides the tone's default glyph, where a more specific one says it better (`verified`, `time`). */
  readonly icon?: IconName;
  readonly style?: StyleProp<ViewStyle>;
}

const DEFAULT_ICON: Readonly<Record<BannerTone, IconName>> = {
  neutral: 'info',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

/**
 * `neutral` and `info` share the `info` glyph and differ in colour: neutral is a note, info is a
 * statement the app is making. If the two ever need to be told apart at a glance, the neutral one should
 * pass a more specific `icon` rather than the palette growing a sixth status colour.
 */
const ICON_TONE: Readonly<Record<BannerTone, Tone>> = {
  neutral: 'tertiary',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

const ROLE: Readonly<Record<BannerTone, AccessibilityRole | undefined>> = {
  neutral: undefined,
  info: undefined,
  success: undefined,
  warning: 'alert',
  error: 'alert',
};

const useStyles = createStyles((t) => ({
  frame: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface.secondary,
  },
  /**
   * Nudges the glyph down onto the first line's optical centre. `footnote`'s 18pt line box against a
   * 16pt glyph leaves 1pt to distribute, and putting it above reads better than centring the icon on a
   * three-line paragraph.
   */
  glyph: { marginTop: t.border.hairline },
  copy: { flex: 1, gap: t.spacing.xxs },
}));

export function Banner({ tone = 'neutral', message, title, icon, style }: BannerProps) {
  const styles = useStyles();

  return (
    <View style={[styles.frame, style]} accessibilityRole={ROLE[tone]}>
      <Icon
        name={icon ?? DEFAULT_ICON[tone]}
        size="sm"
        tone={ICON_TONE[tone]}
        style={styles.glyph}
      />
      <View style={styles.copy}>
        {title !== undefined ? (
          <Text variant="subhead" tone="heading">
            {title}
          </Text>
        ) : null}
        <Text variant="footnote" tone="secondary">
          {message}
        </Text>
      </View>
    </View>
  );
}

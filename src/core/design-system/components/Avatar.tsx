/**
 * `Avatar` — a person, as a circle. Three sizes, and three fallback layers that degrade in the order
 * a real app actually needs them.
 *
 * ```
 * source  →  the photo
 * name    →  initials, when there is no photo
 * neither →  the `profile` glyph, when nobody is signed in
 * ```
 *
 * The layering is literal, not a conditional chain: the fallback renders in the circle and the image
 * renders absolutely on top of it. That is what makes a *failed* image degrade correctly — a broken
 * Supabase Storage URL, an expired signed link, a device that lost the network mid-scroll — because
 * `expo-image` simply paints nothing and the initials underneath are already there. A conditional
 * chain would need an `onError` handler and a piece of state per avatar, and it would flash empty for
 * the frame between mount and failure.
 *
 * ## Why it does not accept an `onPress`
 *
 * An avatar is frequently tappable, and making it pressable *here* would mean every list row that
 * shows one inherits a nested touch target inside its own. The row is the control; this is the
 * picture inside it. When the app header's avatar becomes a route to a profile, the header wraps it
 * in an `IconButton`-shaped control and owns the label — which is also the only way the label ends up
 * correct, since "Your profile" is a statement about the destination, not about the image.
 *
 * ## Decorative by default
 *
 * Same rule as `Icon`, for the same reason: an avatar almost always sits beside the person's name, so
 * announcing it repeats what the next line already says. `accessibilityLabel` is there for the case
 * where the picture is the only thing identifying the person.
 */
import { Image } from 'expo-image';
import { View } from 'react-native';

import { createStyles, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

import type { StyleProp, ViewStyle } from 'react-native';
import type { TypographyRole } from '../tokens';
import type { IconSize } from './Icon';

export type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  /**
   * Image URI. A plain string rather than `expo-image`'s `ImageSource`, so the image library stays
   * an implementation detail of this file — an avatar in this app comes from a URL, and widening the
   * type would put `expo-image`'s vocabulary in every call site's imports.
   */
  readonly source?: string;
  /**
   * The person's full name. Used for initials, and only for initials — the accessible name is
   * `accessibilityLabel`, because a caller that wants the avatar announced usually wants it announced
   * as something other than the bare name ("Ada Lovelace, founder").
   */
  readonly name?: string;
  readonly size?: AvatarSize;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Initials: the first character of the first word and of the last, so "Ada Lovelace" is `AL` and
 * "Ada" is `A`. The last word rather than the second because "Ada Byron King Lovelace" should read
 * `AL`, not `AB`.
 *
 * Spread into an array rather than indexed with `[0]`, because `charAt` splits a surrogate pair and
 * an emoji or an astral-plane letter would come back as half a code point and render as `�`. Names
 * from a text field contain both.
 */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return '';

  const first = words[0] ?? '';
  const last = words[words.length - 1] ?? '';
  const lead = [...first][0] ?? '';
  const tail = words.length > 1 ? ([...last][0] ?? '') : '';

  return (lead + tail).toUpperCase();
}

/**
 * Initials type by size.
 *
 * Every heading role is unavailable here — `title3` and `headline` carry `accessibilityRole="header"`
 * from `Text`, and two letters in a circle are not a section heading — so `lg` takes `label` (15/600)
 * rather than the optically ideal 18. The weight therefore rises with the diameter instead of staying
 * flat, which is the usual direction anyway: small type needs less weight to stay legible against a
 * tinted circle, not more.
 */
const INITIALS_ROLE: Readonly<Record<AvatarSize, TypographyRole>> = {
  sm: 'caption',
  md: 'subhead',
  lg: 'label',
};

/** The glyph fills the circle at roughly the ratio a face would, rather than at a fixed size. */
const GLYPH_SIZE: Readonly<Record<AvatarSize, IconSize>> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

const useStyles = createStyles((t) => {
  /**
   * `surface.tertiary` rather than `secondary`: an avatar's plate has to read as a distinct object on
   * a `#F8F8F8` section as well as on white, and one step darker is what survives both. The hairline
   * is what keeps it from dissolving on `#F5F5F5` — the same reason a `Card` has one.
   */
  const circle = {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: t.colors.surface.tertiary,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    borderRadius: t.radius.full,
  } as const;

  return {
    sm: { ...circle, width: t.size.avatarSm, height: t.size.avatarSm },
    md: { ...circle, width: t.size.avatarMd, height: t.size.avatarMd },
    lg: { ...circle, width: t.size.avatarLg, height: t.size.avatarLg },

    // `StyleSheet.absoluteFill` is not used, because the image must sit *inside* the hairline rather
    // than under it — a photo bleeding over the border makes the circle look unclipped on Android,
    // where `overflow: 'hidden'` and a border interact badly.
    photo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  };
});

export function Avatar({ source, name, size = 'md', accessibilityLabel, style }: AvatarProps) {
  const styles = useStyles();
  // Only for the transition duration: `expo-image` takes milliseconds as a prop, not a style, so
  // `createStyles` cannot carry it and the token has to be read off the theme directly.
  const theme = useTheme();
  const initials = name === undefined ? '' : initialsOf(name);
  const isDecorative = accessibilityLabel === undefined;

  return (
    <View
      style={[styles[size], style]}
      accessible={!isDecorative}
      accessibilityRole={isDecorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={isDecorative}
      importantForAccessibility={isDecorative ? 'no-hide-descendants' : 'yes'}
    >
      {initials === '' ? (
        <Icon name="profile" size={GLYPH_SIZE[size]} tone="tertiary" />
      ) : (
        <Text variant={INITIALS_ROLE[size]} tone="secondary">
          {initials}
        </Text>
      )}
      {source !== undefined && (
        <Image
          source={source}
          style={styles.photo}
          contentFit="cover"
          // A short cross-fade rather than a pop, so an avatar arriving late in a scrolling list does
          // not flicker the row.
          transition={{ duration: theme.motion.duration.fast }}
          // The circle underneath already carries the accessible identity, and a second element with
          // the same label would announce the person twice.
          accessible={false}
        />
      )}
    </View>
  );
}

/**
 * `FileDropzone` — the dashed target that asks for a document, and shows the one it was given.
 *
 * ## Why "Browse" is not a button
 *
 * It looks like one, and it is a `View` inside the single `Pressable` that is the whole zone. Making it
 * a real control would nest two touchables: on iOS the outer `Pressable` is an accessibility element and
 * would swallow the inner one, and on Android the inner one would steal taps from the 120pt zone around
 * it — so the large, obvious target would work everywhere except on the words telling you to use it.
 * One control, one announcement, and the pill is the affordance that says where to aim.
 *
 * ## Why the label is not repeated inside the zone
 *
 * The obvious composition prints `label` twice: once in the label row that keeps this field aligned with
 * the `TextField`s beside it, and again as the headline inside the dashes. On screen that is the same
 * three words a hundred points apart, one directly under the other — which reads as a rendering bug, and
 * is one of the few mistakes a user will notice before they notice the design.
 *
 * So the label row owns the ask, and the zone owns the *answer to it*: what will be accepted, and the
 * pill that says where to aim. Assistive technology loses nothing — the zone still carries `label` as its
 * `accessibilityLabel` and `hint` as its `accessibilityHint`, so it announces as one named control with
 * its constraints attached, exactly as it did.
 *
 * ## Why `disabled` carries a hint instead of the component hiding
 *
 * The state this ships in. There is no storage bucket, no `src/core/database`, and no server-side
 * MIME-and-size validation — which CLAUDE.md requires before anything is uploaded — so a picker here
 * would let a user choose a file that goes nowhere. `expo-document-picker` was considered and rejected on
 * question 6 of [the seven](../../../../docs/CONTRIBUTING.md): it is well maintained and works on all
 * three platforms, and it solves no architectural problem while the seam it would feed does not exist.
 *
 * Rendering the zone disabled with an honest hint is the truthful version: the screen is complete, the
 * affordance is visible, and nothing pretends to work. Passing `onPress` is all it takes to switch on,
 * the day the repository layer lands.
 */
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { haptic } from '@/core/haptics';

import { createStyles } from '../theme';
import { FocusRing } from './FocusRing';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

import type { StyleProp, ViewStyle } from 'react-native';

interface FileDropzoneProps {
  /** What is being asked for: "Upload proof of your role". Not "Upload" — that is the verb, not the ask. */
  readonly label: string;
  /** The constraints, stated before the user hits them: accepted types and the size cap. */
  readonly hint: string;
  /** Omit to render the zone inert. See the note above on why that is the honest default here. */
  readonly onPress?: () => void;
  /** When set, the zone is replaced by the chosen file and a control to clear it. */
  readonly filename?: string;
  readonly onRemove?: () => void;
  readonly optional?: boolean;
  readonly error?: string;
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  /**
   * Dashed, because a dashed outline is the one border treatment that reads as "not yet filled" without
   * a colour or a fill — which is what this design language has to work with. `border.strong` rather
   * than `subtle`: a dashed `#EAEAEA` at one point disappears into the page.
   */
  zone: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
    paddingVertical: t.spacing.xl2,
    paddingHorizontal: t.spacing.lg,
    borderWidth: t.border.hairline,
    borderStyle: 'dashed',
    borderColor: t.colors.border.strong,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface.primary,
  },
  zoneHovered: {
    borderColor: t.colors.text.heading,
    backgroundColor: t.colors.surface.secondary,
  },
  zonePressed: { backgroundColor: t.colors.action.secondaryPressed },
  zoneInvalid: { borderColor: t.colors.status.error },
  zoneInert: { opacity: t.opacity.disabled },

  /** Looks like a control, is not one. See the docblock. */
  browsePill: {
    marginTop: t.spacing.xxs,
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.surface.primary,
  },

  /**
   * The filled state is a solid-bordered row, not a dashed box: the dashes were the invitation, and once
   * there is a file the component's job is to name it and offer to remove it.
   */
  filled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 56,
    paddingLeft: t.spacing.md,
    paddingRight: t.spacing.xxs,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface.primary,
  },
  filename: { flex: 1 },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
    marginTop: t.spacing.xs,
  },
  errorText: { flex: 1 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: t.spacing.xxs,
    marginBottom: t.spacing.xs,
  },
}));

export function FileDropzone({
  label,
  hint,
  onPress,
  filename,
  onRemove,
  optional = false,
  error,
  style,
}: FileDropzoneProps) {
  const styles = useStyles();
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);

  const invalid = error !== undefined && error.length > 0;
  const inert = onPress === undefined;
  const hasFile = filename !== undefined && filename.length > 0;

  const handlePress = useCallback(() => {
    haptic('tap');
    onPress?.();
  }, [onPress]);

  return (
    <View style={style}>
      <View style={styles.labelRow}>
        <Text variant="subhead" tone="secondary">
          {label}
        </Text>
        {optional ? (
          <Text variant="caption" tone="tertiary">
            Optional
          </Text>
        ) : null}
      </View>

      {hasFile ? (
        <View style={styles.filled}>
          <Icon name="upload" size="md" tone="tertiary" />
          <Text variant="body" tone="heading" numberOfLines={1} style={styles.filename}>
            {filename}
          </Text>
          {onRemove !== undefined ? (
            <IconButton
              name="close"
              accessibilityLabel={`Remove ${filename}`}
              onPress={onRemove}
              tone="tertiary"
            />
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={handlePress}
          disabled={inert}
          onHoverIn={() => {
            setHovered(true);
          }}
          onHoverOut={() => {
            setHovered(false);
          }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          style={({ pressed }) => [
            styles.zone,
            isHovered && !inert && styles.zoneHovered,
            pressed && styles.zonePressed,
            invalid && styles.zoneInvalid,
            inert && styles.zoneInert,
          ]}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={invalid ? error : hint}
          accessibilityState={{ disabled: inert }}
        >
          <Icon name="upload" size="lg" tone="tertiary" />
          {/* The constraints are the zone's own line, because the label row above already made the ask.
              `subhead` rather than `caption`: alone in a 100pt box, fine print reads as a caption
              floating in space, and this is the sentence that stops a user picking a 40MB video. */}
          <Text variant="subhead" tone={inert ? 'disabled' : 'secondary'} align="center">
            {hint}
          </Text>
          {!inert ? (
            <View style={styles.browsePill}>
              <Text variant="subhead" tone="heading">
                Browse
              </Text>
            </View>
          ) : null}
          <FocusRing visible={isFocused && !inert} radius="lg" />
        </Pressable>
      )}

      {invalid ? (
        <View style={styles.errorRow}>
          <Icon name="error" size="sm" tone="error" />
          <Text variant="footnote" tone="error" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

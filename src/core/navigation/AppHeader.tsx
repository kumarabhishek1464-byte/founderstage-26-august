/**
 * `AppHeader` — who you are and where you are on the left, what is waiting for you on the right.
 *
 * ```
 * ┌──────────────────────────────────────────────────────────┐
 * │ (◯)  FounderStage                            ⌾      ⌾    │
 * └──────────────────────────────────────────────────────────┘
 *   avatar  wordmark                       notifications  chat
 * ```
 *
 * 56pt tall, white, one hairline at the bottom, and nothing else — no shadow, no title, no back
 * chevron. It sits *above* the navigator rather than inside it, so it does not slide or cross-fade
 * when the destination changes: the identity of the application is not a per-screen decoration, and a
 * header that re-animates on every tab is the single clearest tell of a shell assembled from
 * defaults.
 *
 * ## Full-bleed on purpose
 *
 * The header is not clamped to `size.contentMaxWidth` the way `Screen`'s content and `TabBar`'s row
 * are. Chrome is not content. Clamping it on a 1440pt display would float a white strip in the middle
 * of the window with the hairline stopping short on both sides, and the wordmark would stop lining up
 * with the rail beneath it. Instead the hairline runs edge to edge and the wordmark sits at 24 —
 * which is `Screen`'s gutter and the rail's glyph column, so all three share one vertical line.
 *
 * ## The asymmetric padding is deliberate
 *
 * 24 on the left, 12 on the right. Text has a hard edge and lands where it is put; a glyph centred in
 * a 40pt circle has roughly 10pt of its own transparent margin before the ink starts. Padding both
 * sides to 24 would put the wordmark's ink at 24 and the bell's ink at 34, and the right side would
 * read as indented. 12 puts the ink at about 22 — two points from parity, which is closer than the
 * eye resolves at this size. Boxes are aligned to the number; ink is aligned to the eye.
 *
 * ## The avatar does not do anything yet
 *
 * It is `Avatar` with no `source` and no `name`, so it renders the `profile` glyph — a correct
 * signed-out state, not a placeholder. It is deliberately **not** pressable: there is no auth and no
 * profile route, so a tappable avatar would either lead nowhere or lead to a screen invented to give
 * it a destination. The trigger for wrapping it in a control is authentication, and at that point the
 * control owns the label ("Your profile") because that names the destination rather than the picture.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, IconButton, Wordmark } from '@/core/design-system';

import { createStyles, useTheme } from '../design-system/theme';

const useStyles = createStyles((t) => ({
  chrome: {
    backgroundColor: t.colors.surface.primary,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.border.subtle,
  },
  row: {
    height: t.size.chrome,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // `spacing.sm` between the avatar and the wordmark: close enough to read as one lockup — a person
  // inside a product — rather than as two unrelated items that happen to share a corner.
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  // `spacing.xxs`, because each `IconButton` already carries 10pt of its own padding around a 20pt
  // glyph. Anything wider and the two actions stop reading as a pair.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
  },
}));

export function AppHeader() {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    // `paddingTop` rather than a `SafeAreaView`, so the white and the hairline are one continuous
    // surface from the top of the display down — the status bar sits on the header, not above it.
    <View style={[styles.chrome, { paddingTop: insets.top }]}>
      <View
        style={[
          styles.row,
          {
            paddingLeft: theme.spacing.xl + insets.left,
            paddingRight: theme.spacing.sm + insets.right,
          },
        ]}
      >
        <View style={styles.brand}>
          <Avatar size="md" />
          <Wordmark />
        </View>

        <View style={styles.actions}>
          <IconButton
            name="notifications"
            accessibilityLabel="Notifications"
            onPress={() => {
              router.push('/notifications');
            }}
          />
          <IconButton
            name="chat"
            accessibilityLabel="Messages"
            onPress={() => {
              router.push('/chat');
            }}
          />
        </View>
      </View>
    </View>
  );
}

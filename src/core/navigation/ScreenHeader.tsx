/**
 * `ScreenHeader` — the header for a screen you pushed and will come back from.
 *
 * ```
 * ┌──────────────────────────────────────────────────────────┐
 * │ ‹   Notifications                                        │
 * └──────────────────────────────────────────────────────────┘
 * ```
 *
 * Same 56pt, same white, same hairline as `AppHeader`, so a pushed screen reads as the same
 * application rather than as a modal from somewhere else. The difference is what the left slot holds:
 * `AppHeader` holds who you are, this holds the way back.
 *
 * ## Why not react-navigation's header
 *
 * The stack ships one, and `headerShown: false` turns it off for the same reason the tab bar is not
 * `@react-navigation/bottom-tabs`: it comes with its own type metrics, its own back chevron, its own
 * large-title behaviour on iOS and its own left-aligned title on Android. Every one of those is a
 * decision this design language has already made differently, and reversing them through
 * `headerTitleStyle`/`headerBackImageSource`/`headerTitleAlign` gets you a header that is nearly right
 * on one platform. 30 lines of `View` is cheaper than that and identical everywhere.
 *
 * The title is `headline` rather than `title3`: a pushed screen's name is a peer of the wordmark's
 * weight, not louder than it, and the screen's own content supplies the `title1` if it needs one.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Text } from '@/core/design-system';

import { createStyles, useTheme } from '../design-system/theme';

interface ScreenHeaderProps {
  readonly title: string;
}

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
    gap: t.spacing.xxs,
  },
}));

export function ScreenHeader({ title }: ScreenHeaderProps) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.chrome, { paddingTop: insets.top }]}>
      <View
        style={[
          styles.row,
          {
            // `spacing.sm`, not `spacing.xl`: the chevron's ink starts 10pt inside its 40pt circle, so
            // 12 puts it at 22 — the same optical edge as `AppHeader`'s right-hand actions.
            paddingLeft: theme.spacing.sm + insets.left,
            paddingRight: theme.spacing.sm + insets.right,
          },
        ]}
      >
        <IconButton
          name="back"
          accessibilityLabel="Back"
          tone="heading"
          onPress={() => {
            router.back();
          }}
        />
        <Text variant="headline" tone="heading" numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

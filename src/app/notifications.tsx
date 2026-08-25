import { Screen, Text, useTheme } from '@/core/design-system';
import { ScreenHeader } from '@/core/navigation';

/**
 * Pushed onto the root stack rather than added as a sixth tab. Notifications are a stream you check
 * and leave, not a place you work — giving them a permanent slot in the bar would spend a fifth of the
 * primary navigation on an inbox, and the bell in the header is already the affordance.
 */
export default function NotificationsScreen() {
  const theme = useTheme();

  return (
    <>
      <ScreenHeader title="Notifications" />
      <Screen
        scroll
        safeTop={false}
        contentStyle={{ paddingTop: theme.spacing.xl3, gap: theme.spacing.xs }}
      >
        <Text variant="title1" tone="heading">
          You are up to date
        </Text>
        <Text variant="body" tone="secondary">
          Introductions, replies to your raise, and answers on roles you posted will land here.
        </Text>
      </Screen>
    </>
  );
}

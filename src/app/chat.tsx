import { Screen, Text, useTheme } from '@/core/design-system';
import { ScreenHeader } from '@/core/navigation';

/**
 * "Messages" in the interface, `chat` as the route. The header action is labelled with the word a
 * person would use; the path stays short because it is typed and shared.
 */
export default function ChatScreen() {
  const theme = useTheme();

  return (
    <>
      <ScreenHeader title="Messages" />
      <Screen
        scroll
        safeTop={false}
        contentStyle={{ paddingTop: theme.spacing.xl3, gap: theme.spacing.xs }}
      >
        <Text variant="title1" tone="heading">
          No conversations yet
        </Text>
        <Text variant="body" tone="secondary">
          Reach out from a founder, investor or advisor profile and the thread opens here.
        </Text>
      </Screen>
    </>
  );
}

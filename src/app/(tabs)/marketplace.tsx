import { Screen } from '@/core/design-system';
import { DestinationPlaceholder } from '@/core/navigation';

/**
 * The safe-area insets are already handled by the chrome around this screen — `AppHeader` pads for the
 * status bar and `TabBar` pads for the home indicator — so a screen that padded for them again would
 * inset its content twice.
 */
export default function MarketplaceScreen() {
  return (
    <Screen scroll safeTop={false} safeBottom={false}>
      <DestinationPlaceholder destination="marketplace" />
    </Screen>
  );
}

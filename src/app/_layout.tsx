import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Foundation root layout.
 *
 * The provider composition still lands as a single `AppProviders` component, and it is not that yet:
 * with only `ThemeProvider` to compose, a wrapper would be one provider behind an indirection. It is
 * created when there is an *ordering* to define — query client in stage 5, auth in stage 6 — which is
 * the problem it exists to solve.
 *
 * `SafeAreaProvider` is deliberately absent: expo-router's `ExpoRoot` already supplies one
 * (`expo-router/build/ExpoRoot.js`), and a second nested provider re-measures the same window and
 * reports insets from the wrong frame.
 *
 * Importing `@/core/config/env` at the top of the tree is deliberate: it makes the startup
 * validation run before any screen mounts, so misconfiguration surfaces as a named error
 * rather than a failed query several screens later.
 */
import { env, logLevel } from '@/core/config/env';
import { ThemeProvider, useTheme } from '@/core/design-system';
import { logger } from '@/core/observability';

/**
 * Module scope, not an effect: this runs once when the bundle is evaluated, which is what
 * "the app started" actually means. An effect would additionally re-run on remount.
 *
 * `info`, so it is suppressed in a production build (which logs at `warn`) — correctly.
 * This line exists to answer "which project and which level am I actually pointed at"
 * while developing; in production that context arrives as Sentry tags on every event, not
 * as a log line nobody reads. Nothing here is a credential: the environment name, the
 * level and the platform are all build configuration.
 */
logger.info('FounderStage starting', {
  environment: env.EXPO_PUBLIC_ENV,
  logLevel,
  platform: Platform.OS,
  devTools: env.EXPO_PUBLIC_ENABLE_DEV_TOOLS,
});

/**
 * Split from `RootLayout` because `useTheme()` throws outside the provider, so the component that
 * reads the surface colour cannot be the same component that installs the theme.
 *
 * The navigator's `contentStyle` is the one place the background *must* be set outside a `Screen`:
 * it paints each card, and a card is painted before and after the screen inside it — during a push,
 * and for the frame between mount and first paint. Without it, react-navigation's own
 * `DefaultTheme.colors.background` shows through, which is `#F2F2F2` — verified in the rendered DOM,
 * where it is the layer immediately beneath this one.
 *
 * That default is *still* underneath: `contentStyle` covers the card, not the container the cards
 * animate inside, so a transition between two routes can expose a grey edge. Overriding it means
 * `ThemeProvider` from `@react-navigation/native`, which this project does not declare — it arrives
 * transitively through expo-router, and importing a transitive dependency is how a version bump
 * becomes a mystery. It is deferred rather than ignored: there is one route today, so no transition
 * exists to expose anything. The trigger is the second route.
 */
function RootStack() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.surface.primary },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      {/* Dark glyphs on white chrome. No dark mode — ADR-0013.
          `backgroundColor` is intentionally absent: Android is always edge-to-edge from
          SDK 54, so the status bar is translucent and the prop no longer exists. The
          white behind it comes from the config's `backgroundColor` and the Stack's
          `contentStyle`. */}
      <StatusBar style="dark" />
      <RootStack />
    </ThemeProvider>
  );
}

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

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
 * Held at module scope so a fast-refresh mount does not race the initial one. Wrapped in a
 * try/catch because it throws on the second call (harmlessly, but noisily).
 */
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Already prevented on this JS instance — nothing to do.
});

/**
 * Module scope, not an effect: this runs once when the bundle is evaluated, which is what
 * "the app started" actually means. An effect would additionally re-run on remount.
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
  /**
   * Inter is loaded here, at the tree root, so every `Text` further down speaks in the same
   * face. The names below are the exact identifiers the typography tokens reference in
   * `fontFamily`; if the two ever drift, glyphs render in the platform default and the type
   * system does not catch it — that is why the family map lives in a single tokens file and
   * the loader keys reference the same identifiers.
   *
   * `fontError` is intentionally not fatal. A device that fails to fetch a webfont should
   * render the platform typeface rather than an empty screen: Inter's proportions match SF
   * Pro closely enough that a fallback run is a graceful degradation, not a broken app.
   */
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError !== null) {
      // Fire-and-forget: the promise resolves after the fade completes, and nothing here
      // waits on it. A rejection would only mean the splash is already gone.
      void SplashScreen.hideAsync().catch(() => {
        // Ignored — the splash was already hidden.
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && fontError === null) {
    // Keep the splash visible until either the family loads or we know it will not.
    return null;
  }

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

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Three build profiles map to three installable apps, so development, preview and
 * production can coexist on one device without uninstalling each other.
 */
type AppEnv = 'development' | 'preview' | 'production';

const APP_ENV = (process.env.EXPO_PUBLIC_ENV ?? 'development') as AppEnv;

const IDENTITY: Record<AppEnv, { name: string; id: string; scheme: string }> = {
  development: {
    name: 'FounderStage (Dev)',
    id: 'com.founderstage.app.dev',
    scheme: 'founderstage-dev',
  },
  preview: {
    name: 'FounderStage (Preview)',
    id: 'com.founderstage.app.preview',
    scheme: 'founderstage-preview',
  },
  production: {
    name: 'FounderStage',
    id: 'com.founderstage.app',
    scheme: 'founderstage',
  },
};

const identity = IDENTITY[APP_ENV];

/**
 * The design language is white-dominant with no dark mode
 * (docs/adr/0013-single-light-theme.md), so every piece of OS-owned chrome —
 * splash, adaptive icon background, root view — is pinned to white. Left to the
 * system, a device in dark mode renders dark chrome around a white app.
 */
const SURFACE_WHITE = '#FFFFFF';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: identity.name,
  slug: 'founderstage',
  version: '0.1.0',
  scheme: identity.scheme,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: SURFACE_WHITE,
  // No `newArchEnabled`: SDK 57 ships New Architecture only, so the flag was removed
  // from the config type. There is no legacy-architecture escape hatch to opt out of.

  experiments: {
    typedRoutes: true,
    reactCompiler: false,
  },

  ios: {
    bundleIdentifier: identity.id,
    supportsTablet: true,
    // Ships the app in light appearance regardless of the device setting.
    userInterfaceStyle: 'light',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: identity.id,
    userInterfaceStyle: 'light',
    // No `edgeToEdgeEnabled`: SDK 54 removed the opt-in and edge-to-edge is now always
    // on for Android, so setting it is a type error rather than a no-op.
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: SURFACE_WHITE,
    },
  },

  web: {
    // SPA for the foundation phase; static rendering is a deliberate deferral.
    // docs/adr/0012-web-spa-output.md
    output: 'single',
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },

  plugins: [
    'expo-router',
    'expo-status-bar',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: SURFACE_WHITE,
      },
    ],
    'expo-font',
    'expo-image',
    'expo-secure-store',
    'expo-localization',
    [
      '@sentry/react-native/expo',
      {
        // Read at build time from the CI environment; never committed.
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ],
  ],

  extra: {
    appEnv: APP_ENV,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});

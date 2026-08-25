import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The HTML shell for `web.output: 'static'` / `'server'`. Static and build-time only —
 * this file never runs in the browser, so it cannot read state or use hooks.
 *
 * **Not used today.** Web output is `single` (ADR-0012), and single-page output takes its
 * shell from `public/index.html` instead — Expo's `createTemplateHtmlAsync` reads that
 * file and only the static/server export path renders `+html.tsx`. The file is kept so
 * the deferral in ADR-0012 stays cheap to reverse.
 *
 * The two shells must be kept in agreement: change one, change the other, or switching
 * `web.output` silently changes the document. The differences that are deliberate:
 * the CSP below is absent from `public/index.html` (a static file cannot vary between
 * dev and production — see `public/_headers`), and `ScrollViewStyleReset` is written out
 * as literal CSS there because there is no React to render it.
 */

/**
 * `unsafe-inline` for styles is not optional: react-native-web emits inline styles for
 * every component, and no nonce scheme can cover them. `unsafe-eval` in scripts is
 * required by Metro's dev-time HMR only, so it is gated on __DEV__ and absent from
 * production bundles.
 *
 * Supabase needs to be reachable over both https and wss (Realtime). `connect-src`
 * uses a wildcard host under those schemes rather than the project URL, because this
 * file is evaluated at build time and inlining a per-environment URL here would break
 * the shared shell.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${__DEV__ ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:" + (__DEV__ ? ' ws: http:' : ''),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />

        {/* No dark mode (ADR-0013). Declaring `light` stops the browser from applying
            its own dark form controls and scrollbars over a white app. */}
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#FFFFFF" />

        {/* Resets body scroll so ScrollView children scroll instead of the document —
            without this, web layout diverges from native. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: BASE_STYLES }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

/**
 * Deliberately tiny. Anything beyond preventing a flash of the wrong background
 * belongs in the design system, not here — this stylesheet cannot read theme tokens.
 */
const BASE_STYLES = `
html, body, #root {
  background-color: #FFFFFF;
}
body {
  overscroll-behavior-y: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
* {
  -webkit-tap-highlight-color: transparent;
}
`;

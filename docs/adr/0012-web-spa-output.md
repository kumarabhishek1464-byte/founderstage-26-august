# ADR-0012 — Web ships as an SPA; static rendering deferred

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

Expo Router supports three web output modes:

| `web.output` | Behaviour                                            |
| ------------ | ---------------------------------------------------- |
| `single`     | Single-page app, one HTML shell, client-side routing |
| `static`     | One pre-rendered HTML file per route at build time   |
| `server`     | Server-rendered with API routes                      |

FounderStage will eventually want indexable public pages — founder profiles, funding opportunities,
events, jobs. Those benefit substantially from pre-rendering, both for search and for social link
previews.

But the foundation phase builds no features, and therefore no public pages. And `static` imposes
real costs: every route must render without browser APIs at build time, so any component touching
`window`, `localStorage` or a native module needs a guard. Since
[ADR-0010](0010-chunked-secure-storage.md) puts the web session in `localStorage`, the auth provider
is exactly such a component.

Paying that cost now would mean designing around a constraint for pages that do not exist.

## Decision

**`web.output: 'single'`** for the foundation phase.

Deliberately preserved so the switch stays cheap:

- **No `window`/`document` access during module initialisation** anywhere in `src/core`. Browser
  APIs are touched inside effects or lazily, never at import time. This is the property `static`
  actually requires, and it is good practice regardless.
- **`src/app/+html.tsx` exists from the start**, so the shell `static` will render is already
  written. It is **inert under `single`** — see the correction below.
- **All data access goes through repositories** ([ADR-0011](0011-repository-pattern.md)), so a route
  that later needs build-time or server-side data has one seam to call.
- **Web layout is already constrained** to `layout.maxContentWidth` (1120px) rather than stretching
  a mobile layout, so pre-rendered pages will not need a redesign.

### Correction: which file is the shell

The first draft of this ADR claimed `+html.tsx` carries the CSP and meta tags today. That is wrong,
and it was caught by exporting the web build and reading the emitted `dist/index.html`.

`+html.tsx` is rendered **only** by the static/server export path. Under `single`, Expo's
`createTemplateHtmlAsync` reads **`public/index.html`** — falling back to its own template when that
file is absent, which is what the first export produced. So the foundation ships two shells:

| Output mode       | Shell file          |
| ----------------- | ------------------- |
| `single` (today)  | `public/index.html` |
| `static`/`server` | `src/app/+html.tsx` |

Both are committed and must be kept in agreement.

### Where the Content-Security-Policy lives

Not in a `<meta>` tag. `public/index.html` is one static file serving both `expo start --web` and
production, and the two need different policies — Metro's HMR requires `'unsafe-eval'` and a `ws:`
`connect-src` that must never reach production. A meta CSP additionally cannot express
`frame-ancestors`, which is the directive that actually prevents clickjacking, and cannot be rolled
out report-only.

The policy is therefore a response header, declared in **`public/_headers`** (copied verbatim into
`dist/` by `expo export`; read by Netlify and Cloudflare Pages, inert elsewhere). It is **not yet
verified against a live deployment** — no host is configured during the foundation phase — and
`script-src 'self'` in particular needs a report-only pass first, because switching to `static` adds
an inline hydration bootstrap that the current policy would block.

### When to revisit

When the first public, indexable route is built. At that point the likely answer is not a wholesale
switch but **`static` for the public route group** while the authenticated app stays client-rendered
— which is exactly why the `(public)` and `(app)` route groups are separated from day one.

## Consequences

- Simplest possible web build. No pre-render guards to maintain for pages that do not exist.
- **No SEO on web today.** Accepted: there is no public content to index yet.
- Slower first paint than pre-rendered HTML, mitigated by code splitting and the splash screen.
- The route-group split and the no-browser-APIs-at-import-time rule keep the migration bounded.
- **Two shells to keep in sync** (`public/index.html` and `src/app/+html.tsx`) for as long as the
  static switch remains deferred. The cost of the option.
- **Security headers are unenforced until a host is configured.** `public/_headers` declares them;
  nothing applies them yet. This is a real gap, not a solved problem, and it closes when deployment
  is set up.

## Alternatives considered

- **`static` now.** Would force `window` guards and build-time-safe initialisation throughout the
  foundation to serve zero public pages. Premature, and it would shape `core/` around a requirement
  that has not arrived.
- **`server` output.** Adds a server to deploy and operate. It also unlocks httpOnly cookie auth,
  which is genuinely better than `localStorage` — the strongest argument for it. Deferred together
  with the SEO decision, since both point at the same change and should be decided once, with real
  requirements.
- **A separate Next.js web app.** Rejected outright: two codebases, two design system
  implementations, permanent drift. The single-codebase requirement is non-negotiable.

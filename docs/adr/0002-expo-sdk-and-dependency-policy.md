# ADR-0002 — Expo SDK 57, and `expo install` as the only way to add dependencies

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

Expo SDK 57 is the current stable release (`expo@57.0.15`). From roughly SDK 55 onward, Expo
publishes its first-party packages under **unified versioning** — `expo-router`, `expo-image`,
`expo-secure-store` and the rest all track the SDK major.

Third-party native packages do **not**. They release on their own cadence, and Expo maintains a
separate compatibility matrix for them. Checking the registry against the official SDK 57 template
(`expo-template-default@sdk-57`) at the time of writing revealed that `npm latest` is wrong for five
core packages:

| Package                        | `npm latest` | SDK 57 requires | Failure if you take latest                                                                |
| ------------------------------ | ------------ | --------------- | ----------------------------------------------------------------------------------------- |
| `typescript`                   | 7.0.2        | `~6.0.3`        | `typescript-eslint@8` peers `typescript >=4.8.4 <6.1.0` → **lint stops working entirely** |
| `react-native`                 | 0.87.0       | `0.86.2`        | JS/native mismatch against prebuilt Expo modules                                          |
| `react-native-reanimated`      | 4.6.0        | `4.5.1`         | 4.6 peers `react-native-worklets@0.12.x`; SDK 57 ships `0.10.1` → runtime crash           |
| `react-native-worklets`        | 0.12.1       | `0.10.1`        | Same mismatch, from the other side                                                        |
| `react-native-gesture-handler` | 3.2.1        | `~2.32.0`       | Untested major against Reanimated 4.5.1 and `@gorhom/bottom-sheet`                        |

The TypeScript one is the most dangerous because it fails _silently in the wrong direction_:
everything compiles, and the linter — including every architectural boundary rule this codebase
depends on — simply stops running.

## Decision

1. Target **Expo SDK 57**.
2. **All runtime and native dependencies are added with `npx expo install`**, never `npm install`.
   `expo install` resolves against Expo's compatibility service; `npm install` resolves against
   `latest`.
3. `npm install -D` is acceptable **only** for pure-JS tooling that Expo does not track (Prettier,
   dependency-cruiser, husky, lint-staged, Playwright).
4. `expo-doctor` runs in CI, so a drifted dependency fails the build rather than a developer's
   afternoon.
5. **npm is the package manager.** Not pnpm — its default isolated `node_modules` breaks React
   Native autolinking unless `node-linker=hoisted` is set, which is an extra failure mode on Windows
   for no architectural gain.

## Consequences

- Version bumps are deliberate: `npx expo install --check` / `--fix` on SDK upgrade.
- Occasionally we run a slightly older version of a library than is available. Accepted — a working
  native build is worth more than a patch version.
- `typescript` stays pinned to `~6.0.3` until `typescript-eslint` widens its peer range. Revisit
  when it supports TS 7.

## Alternatives considered

- **Pin everything by hand in `package.json`.** This is how the traps above get baked in. Expo's
  matrix is authoritative; our guesses are not.
- **Renovate/Dependabot auto-merge.** Would happily bump us to `typescript@7` and break lint.
  Dependency updates need `expo install --fix`, not naive semver bumps.
- **pnpm** for install speed. Rejected: see above.

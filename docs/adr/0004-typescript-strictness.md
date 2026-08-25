# ADR-0004 — TypeScript strictness profile

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

The requirement is "strict TypeScript, no `any`". TypeScript's `strict` family is not a single
switch — several additional flags sit outside it, and they differ sharply in signal-to-noise ratio
when applied to a React Native codebase.

## Decision

Enabled, on top of `expo/tsconfig.base`:

| Flag                                    | Why                                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strict`                                | Baseline. Non-negotiable.                                                                                                                                  |
| `noUncheckedIndexedAccess`              | **Highest-value flag not in `strict`.** `arr[0]` becomes `T \| undefined`, which is the truth. Catches real crashes in list, pagination and parsing code.  |
| `noImplicitOverride`                    | Prevents accidental shadowing in class-based adapters.                                                                                                     |
| `noFallthroughCasesInSwitch`            | Error normalisation and permission mapping are switch-heavy.                                                                                               |
| `noImplicitReturns`                     | A function that returns a value on some paths and not others is a bug.                                                                                     |
| `noUnusedLocals` / `noUnusedParameters` | Keeps dead code out of a foundation nobody has exercised yet.                                                                                              |
| `forceConsistentCasingInFileNames`      | Development is on Windows (case-insensitive); CI and EAS are Linux (case-sensitive). Without this, a wrong-case import works locally and fails only in CI. |

**Deliberately NOT enabled: `exactOptionalPropertyTypes`.**

This is the one that looks like it belongs and doesn't. Under it, given `title?: string`, writing
`<Button title={maybeUndefined} />` is an error — you must conditionally spread instead. That
pattern is pervasive in React component composition, so the flag imposes a cost on nearly every
component in the design system while catching approximately nothing: our domain models come from Zod
parsing and generated database types, which model absence explicitly as `T | null` already.

High friction, low signal, in this codebase. Revisit if we start hand-writing option bags where
"absent" and "present but undefined" carry different meanings.

**Also not enabled: `verbatimModuleSyntax`.** The goal — never emitting a runtime import for a type
— is better served by ESLint's `@typescript-eslint/consistent-type-imports`, which is auto-fixable
and carries no CommonJS interop risk with the Metro/Babel pipeline.

## Rules that are not compiler flags

- **No `any`.** Use `unknown` and narrow. An unavoidable `any` requires an inline disable with a
  written reason.
- **No assertions to silence the compiler.** `as Foo` is for genuine narrowing you can justify, not
  for making an error disappear. Parse or narrow instead.
- **Database types are generated, never authored.** `npm run db:types`. Types flow from Postgres
  into the app; they are never duplicated by hand.
- **Repositories return domain models, not `Row` types.** See
  [ADR-0011](0011-repository-pattern.md).

## Consequences

- `noUncheckedIndexedAccess` requires explicit handling at array and record access sites. This is
  the point; it is where the bugs are.
- We accept a narrow class of optional-property bug that `exactOptionalPropertyTypes` would catch,
  in exchange for not fighting it in every component signature.

## Alternatives considered

- **Maximum strictness, every flag on.** Tempting as a signal of rigour, but a strictness setting
  that developers work around with `?? undefined` spreads produces _worse_ types than one they work
  with. Strictness has to be chosen for signal, not for its own sake.
- **`strict` only.** Leaves `noUncheckedIndexedAccess` off, which is the flag that would actually
  have caught bugs in pagination and parsing.

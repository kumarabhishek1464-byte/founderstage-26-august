# ADR-0003 — Single `core/` tree; no separate `services/` layer

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

The initial proposed structure had both a `core/` and a `services/` top level:

```
core/storage/       services/storage/
core/analytics/     services/analytics/
core/networking/    services/api/
```

The intent was a ports-and-adapters split: `core/` holds the interface the app programs against,
`services/` holds the infrastructure implementation.

The intent is right. The layout is not. It creates **two plausible homes for the same concern**, and
a developer adding a storage helper cannot reliably guess which one it belongs in. In practice both
directories accumulate code, the boundary blurs, and within a few months there is storage logic in
both places — the precise outcome the split was meant to prevent.

The proposed structure had the same problem at the type level: both `src/types/` and
`src/core/types/`.

## Decision

**One home per concern.** Ports and adapters are co-located inside a single capability folder:

```
src/core/storage/
├── index.ts                 ← the port: KeyValueStore interface + public exports
├── adapters/
│   ├── secure.native.ts     ← expo-secure-store, with chunking
│   ├── secure.web.ts        ← localStorage
│   └── async.ts             ← AsyncStorage, non-sensitive values
└── storage.test.ts
```

- `src/services/` does not exist.
- `src/types/` does not exist; shared types live in `src/core/types/`.
- Generated database types live at `src/core/database/types.generated.ts`.
- Domain types live in `src/features/<domain>/model/`.
- **Server-side code lives in `supabase/` at the repository root**, outside `src/`. Edge Functions
  run on Deno, not React Native — they must not share a `tsconfig` with the app, and the physical
  separation makes "this never ships to the client" self-evident.

The hexagonal boundary is preserved: the adapter is still swappable, `index.ts` is still the only
public surface. It is just no longer split across two trees.

## Consequences

- "Where does this go?" has one answer. Ambiguity was the actual cost being paid.
- Swapping an implementation touches one folder.
- A capability's port, adapters and tests are read together.
- Cost: `core/` has more direct children. Acceptable — they are flat, named after capabilities, and
  each is self-contained.

## Alternatives considered

- **Keep `services/` for vendor SDK wrappers only.** Still requires a judgement call per file, which
  is the problem.
- **`core/ports/` + `core/adapters/`.** Same split, one level deeper, and now a capability's
  interface and implementation are in different folders.

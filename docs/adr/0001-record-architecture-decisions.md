# ADR-0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

FounderStage is a foundation built before its features. Most of the load-bearing choices — how data
is fetched, where authorization is enforced, what styling engine is used — are made once and then
implicitly depended on by every feature that follows. Six months later the reasoning is gone and the
only artifact left is the code, which shows _what_ was chosen but never _why_, or what was rejected
and on what grounds.

Without a record, two failure modes follow. Someone "fixes" a deliberate constraint because it looks
arbitrary. Or someone re-litigates a settled decision because there's no evidence it was ever
considered.

## Decision

Record every significant architectural decision as a numbered ADR in `docs/adr/`, using the format
of this file: **Context** (the forces), **Decision** (what we do), **Consequences** (what we accept,
good and bad), **Alternatives considered** (what we rejected and why).

A decision is significant if it is expensive to reverse, constrains future features, or would
surprise a competent engineer reading the code cold.

ADRs are immutable once accepted. To change a decision, write a new ADR that supersedes the old one
and update the old one's status to `Superseded by ADR-XXXX`.

## Consequences

- Reviewers can challenge the reasoning, not just the diff.
- A rejected alternative stays rejected for a documented reason.
- Cost: a short document per real decision. Not per pull request.

## Alternatives considered

- **Comments in code.** Wrong altitude — a decision spanning eight directories has no single file to
  live in.
- **A wiki.** Drifts from the code, and isn't reviewed alongside it.

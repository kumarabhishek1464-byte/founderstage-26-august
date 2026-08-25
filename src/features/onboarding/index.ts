/**
 * The `onboarding` feature's public surface: the five screen bodies, and nothing else.
 *
 * The draft store is deliberately internal. It is this flow's working state — a half-answered profile that
 * only makes sense between the first step and the last — and a route or another feature reaching into it
 * would be reading PII that has no owner yet. When the profile is something the rest of the app can read,
 * it will be a query against a table, not this store.
 *
 * Features cannot import each other (`dependency-cruiser`: `features-must-not-import-each-other`), so this
 * file exists for `src/app` alone.
 */
export { AboutYouView } from './components/AboutYouView';
export { CompleteView } from './components/CompleteView';
export { InterestsView } from './components/InterestsView';
export { RoleView } from './components/RoleView';
export { VerificationView } from './components/VerificationView';

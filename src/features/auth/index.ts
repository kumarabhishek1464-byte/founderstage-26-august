/**
 * The `auth` feature's public surface: three screen bodies and the two value shapes a route needs in order
 * to type its submit handler.
 *
 * Everything else is internal on purpose. `OrDivider`, `LegalNote` and `WelcomeHero` are this feature's
 * private vocabulary, and the two form hooks are how the views get their state — a route that reached for
 * `useLoginForm` would be building a second login screen, and
 * [rule 1](../../../CLAUDE.md) says extend the first one instead. Features cannot import each other at all
 * (`dependency-cruiser`: `features-must-not-import-each-other`), so this file exists for `src/app` and for
 * nobody else.
 *
 * The routes stay thin because of the split: each one owns navigation and nothing else, and every decision
 * about layout, validation and copy is in here where it can be read in one place.
 */
export { LoginView } from './components/LoginView';
export { SignupView } from './components/SignupView';
export { WelcomeView } from './components/WelcomeView';

export type { LoginValues, SignupValues } from './model/schemas';

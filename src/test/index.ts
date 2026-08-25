/**
 * Shared test infrastructure. `import { render, screen } from '@/test'`.
 *
 * Nothing that ships may import this directory — enforced by
 * `production-must-not-import-test-utils` in `.dependency-cruiser.cjs`, because it pulls in
 * `@testing-library/react-native` (a devDependency) and Metro does not tree-shake.
 */
export * from './render';

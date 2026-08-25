/**
 * The public surface of the error model. Import from `@/core/errors`, not from the files
 * behind it — the split between `app-error` and `normalise` is an implementation detail.
 */
export { APP_ERROR_KINDS, AppError, isAppError, isRateLimited } from './app-error';
export type { AppErrorKind, AppErrorOptions } from './app-error';
export { toAppError } from './normalise';

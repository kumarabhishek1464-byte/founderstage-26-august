/**
 * The database module's public surface.
 *
 * ```ts
 * import { toDatabaseError } from '@/core/database';
 * import type { Enums, Tables } from '@/core/database';
 * ```
 *
 * **The client is deliberately absent.** `no-restricted-imports` already refuses
 * `@/core/database/client` everywhere except this directory and a feature's `api/repository.ts`, so
 * re-exporting it here would open a hole through the barrel — `@/core/database` would pass the lint
 * rule while handing a screen the same object. A repository imports `./client` by path, and that
 * path is the thing the rule watches.
 *
 * What is here is the vocabulary everything else needs: the row and enum aliases, and the one
 * function that turns a Supabase failure into an `AppError`. Both are safe from anywhere — the types
 * erase at compile time, and `toDatabaseError` is pure.
 */
export { serverErrorTag, toDatabaseError } from './errors';

export type {
  Database,
  EnumName,
  Enums,
  FunctionArgs,
  FunctionName,
  FunctionReturns,
  Json,
  PublicSchema,
  TableName,
  Tables,
  TablesInsert,
  TablesUpdate,
  ViewName,
  Views,
} from './schema';

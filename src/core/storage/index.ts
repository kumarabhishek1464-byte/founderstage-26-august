/**
 * The two stores, and the port they implement.
 *
 * ```ts
 * import { STORAGE_KEYS, secureStore, appStore } from '@/core/storage';
 * ```
 *
 * `secureStore` is credentials — the keychain on native, `localStorage` on web (see
 * `secure-store.web.ts` for why that is the honest choice and what actually protects it).
 * `appStore` is the query cache and client flags, and nothing sensitive.
 *
 * `createChunkedStore` is exported for the native session path and for its own tests. It is not
 * something a feature should ever need: `secureStore` is already chunked.
 */
export { appStore } from './app-store';
export { DEFAULT_CHUNK_SIZE, createChunkedStore, splitByUtf8Bytes } from './chunked-store';
export { STORAGE_KEYS } from './key-value-store';
export { secureStore } from './secure-store';
export type { KeyValueStore, StorageKey } from './key-value-store';

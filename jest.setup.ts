/**
 * Runs before every test file, in all three platform projects.
 *
 * Kept deliberately small. Global mocks hide real integration problems, so only things
 * that are genuinely unavailable in a Node/jsdom test environment are stubbed here —
 * not things that are merely inconvenient.
 */

/**
 * `env.ts` throws at import time when configuration is missing, which is correct in the
 * app and wrong in a test runner: CI has no `.env.local`. Supplying valid-shaped fake
 * values keeps the validator itself under test (its own suite parses explicitly) while
 * letting every other module import `env` freely.
 *
 * The anon key is a structurally valid but meaningless JWT — three base64 segments.
 */
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.test';
process.env.EXPO_PUBLIC_ENV ??= 'development';

/**
 * expo-secure-store is a native module with no JS fallback. An in-memory implementation
 * lets the chunked storage adapter's own tests exercise real chunking logic against a
 * store that behaves like the real one — including the 2048-byte rejection, which is the
 * behaviour the adapter exists to work around.
 */
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  const ANDROID_VALUE_LIMIT = 2048;
  // TextEncoder rather than Buffer: @types/node is deliberately excluded from
  // tsconfig `types`, and this measures UTF-8 bytes identically in node and jsdom.
  const byteLength = (value: string) => new TextEncoder().encode(value).length;

  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      if (byteLength(value) > ANDROID_VALUE_LIMIT) {
        return Promise.reject(
          new Error(`Value for key ${key} exceeds the ${ANDROID_VALUE_LIMIT} byte limit`)
        );
      }
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
    __reset: () => store.clear(),
  };
});

/**
 * AsyncStorage backs `appStore`, and its native module cannot exist under Jest — importing it
 * throws `NativeModule: AsyncStorage is null` at module scope, which fails the *suite* rather than
 * a test. The package ships its own mock for exactly this, and using it rather than a hand-written
 * one matters: `appStore` is a thin adapter, so a hand-written double would be testing this file's
 * idea of AsyncStorage instead of AsyncStorage's.
 *
 * Registered here rather than per-suite because the failure is at import time, so any suite that
 * transitively reaches `@/core/storage` needs it — which, once the query persister lands, is most
 * of them.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual<object>('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

/** Silences the "not implemented: navigation" jsdom noise in the web project. */
if (typeof window !== 'undefined') {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

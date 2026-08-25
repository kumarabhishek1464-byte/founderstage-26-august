/**
 * Chunking, as a decorator over a byte-limited store.
 *
 * `expo-secure-store` rejects values over 2048 bytes on Android — the value goes into
 * `EncryptedSharedPreferences`, and the limit applies to the **encrypted** payload, not to the string
 * handed in. A Supabase session carrying role claims
 * ([ADR-0009](../../../docs/adr/0009-roles-in-jwt.md)) routinely exceeds it, and the failure is a
 * rejected promise on write — so the app signs the user in and then cannot persist the session, which
 * presents as a login bug.
 *
 * The chunking lives here rather than inside `secure-store.ts` because this file has no native
 * dependency: the crash-safety guarantees below are the whole value of the module, and they are
 * unobservable from a test that can only drive a real, working keychain. Against an in-memory fake
 * that fails on a chosen write, they are directly assertable.
 * ([ADR-0014](../../../docs/adr/0014-testing-strategy.md) §1 names this adapter as one of three
 * high-risk surfaces.)
 *
 * ## The process really does get killed mid-write
 *
 * This is not a theoretical concern to be waved at. iOS suspends a backgrounded app and kills it
 * without notice; the app then refreshes its token on resume, which is a multi-chunk write. So the
 * question "what is on disk if we stop between any two awaits?" has to have a good answer for every
 * pair.
 *
 * ## Chunks are written under an alternating generation
 *
 * A single key holds either a plain value or a **manifest**: `__fs.chunked:a:3` — generation `a`,
 * three chunks, stored at `key.__a.0` … `key.__a.2`.
 *
 * A write puts its chunks under the *other* generation, then replaces the manifest, then deletes the
 * old generation's chunks. Nothing a live manifest points at is ever overwritten, which is what makes
 * the commit atomic in effect:
 *
 * | Interrupted…                    | On disk                                          | Read returns   |
 * | ------------------------------- | ------------------------------------------------ | -------------- |
 * | while writing new chunks        | old manifest + old chunks, untouched             | the old value  |
 * | after the manifest, before sweep| new manifest + new chunks; old chunks unreferenced| the new value  |
 * | during a delete                 | manifest with missing chunks                      | `null`         |
 *
 * The naive alternative — reuse the same chunk keys and write the manifest last — fails exactly where
 * it matters most. A refreshed session has the same claims and so usually the same chunk count, so an
 * interrupted rewrite leaves the old manifest pointing at chunk 0 from the new value and chunk 2 from
 * the old one. The counts match, the length matches, and the read succeeds with a corrupt value. Two
 * generations cost one extra read per write and remove the failure mode rather than narrowing it.
 *
 * Alternating between two generations rather than an incrementing counter bounds the leak: at most
 * one stale chunk set can exist, and the next write reclaims those exact keys.
 *
 * ## Read fails closed
 *
 * A manifest claiming three chunks with two present returns `null`, never a truncated string. A
 * truncated JWT handed to `supabase-js` fails to parse and surfaces as an opaque auth error; `null`
 * surfaces as "signed out", which is correct and recoverable.
 *
 * ## Values that fit skip the manifest entirely
 *
 * A short value is stored at the key itself, exactly as an unchunked store would, so the common case
 * costs one read and this decorator is transparent for everything that is not a session — the push
 * prompt flag does not pay for the session's problem. Read distinguishes the two forms by trying the
 * key first and treating only a value of manifest shape as a manifest, which is why the manifest
 * prefix is chosen to be unrepresentable as real content.
 */
import type { KeyValueStore } from './key-value-store';

/**
 * 1800 bytes, against Android's ~2048.
 *
 * The headroom is not superstition: the limit applies after encryption, and AES-GCM adds a 12-byte
 * nonce and a 16-byte tag before base64 expands the result by 4/3. The true safe plaintext size is
 * therefore both smaller than 2048 and dependent on the platform's implementation, which is why this
 * is a parameter rather than a constant baked into the read path — and why the manifest records the
 * chunk count instead of letting the reader recompute it from the size. Lowering this value must not
 * orphan data already on disk.
 */
export const DEFAULT_CHUNK_SIZE = 1800;

/**
 * Marks a stored value as a manifest rather than as content.
 *
 * A prefixed, delimited string rather than JSON, because the read path has to tell a manifest from a
 * legitimate single-chunk value and any JSON shape could in principle *be* the value. This prefix
 * cannot occur in a base64url JWT (which has no `:`), in a JSON document (which starts `{`, `[` or
 * `"`), or in the short flags stored elsewhere. Keeping it a string literal also means the check is a
 * `startsWith`, not a parse that can throw on hostile input.
 */
const MANIFEST_PREFIX = '__fs.chunked:';

/**
 * Two generations, alternating. Single letters because they become part of a SecureStore key, which
 * is constrained to `/^[\w.-]+$/`.
 *
 * A type rather than a `const` array: nothing iterates the generations — the write path flips to the
 * other one and the read path is handed the one the manifest names — so an array would exist only to
 * derive this union from, which the union can state directly.
 */
type Generation = 'a' | 'b';

interface Manifest {
  readonly generation: Generation;
  readonly count: number;
}

/** `key.__a.0`, `key.__a.1`, … */
function chunkKey(key: string, generation: Generation, index: number): string {
  return `${key}.__${generation}.${String(index)}`;
}

function formatManifest(manifest: Manifest): string {
  return `${MANIFEST_PREFIX}${manifest.generation}:${String(manifest.count)}`;
}

/**
 * The manifest a stored value describes, or `null` if the value is content rather than a manifest.
 *
 * Anything malformed after the prefix is `null` — i.e. treated as a plain value, which then fails to
 * parse downstream — rather than defaulted. Rejecting a count of zero matters specifically: an empty
 * string is stored as a single empty chunk, so `count: 0` is not a state this module can produce, and
 * accepting it would let a corrupt manifest read as a successfully-stored empty value. That is a
 * silent wrong answer in a module whose entire purpose is to fail closed.
 */
function parseManifest(value: string): Manifest | null {
  if (!value.startsWith(MANIFEST_PREFIX)) return null;

  const [generation, count, ...rest] = value.slice(MANIFEST_PREFIX.length).split(':');
  if (rest.length > 0) return null;
  if (generation !== 'a' && generation !== 'b') return null;
  if (count === undefined || !/^[1-9][0-9]*$/.test(count)) return null;

  return { generation, count: Number.parseInt(count, 10) };
}

function nextGeneration(current: Manifest | null): Generation {
  return current?.generation === 'a' ? 'b' : 'a';
}

/**
 * UTF-8 byte cost of a single code point.
 *
 * Written out rather than delegated to `TextEncoder`. Hermes has shipped it since React Native 0.74
 * and `react-native-web` inherits the browser's, so it is *probably* present — but "probably present"
 * on the path that persists the session is a poor trade for four lines, and its absence would present
 * as a login that never sticks on one engine.
 */
function utf8Cost(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * Split so that **every piece is at most `maxBytes` once UTF-8 encoded**, and no piece splits a code
 * point.
 *
 * Splitting on `String.length` would be wrong twice over. A code unit is not a byte, so any
 * non-ASCII content would overshoot the platform limit and be rejected. And slicing between the two
 * halves of a surrogate pair yields two lone surrogates, which encode as U+FFFD and silently corrupt
 * the value on rejoin — a JWT with a replacement character in it.
 *
 * `for…of` iterates code points rather than code units, which makes the second problem structurally
 * impossible instead of merely handled.
 *
 * Exported for its own tests: a value landing exactly on the limit, and a 4-byte astral character
 * straddling it, are where this either works or quietly does not.
 */
export function splitByUtf8Bytes(value: string, maxBytes: number): readonly string[] {
  if (value.length === 0) return [''];

  const pieces: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const character of value) {
    // A `for…of` element over a string is always a single non-empty code point, so `codePointAt(0)`
    // is defined — but `noUncheckedIndexedAccess` cannot know that.
    const cost = utf8Cost(character.codePointAt(0) ?? 0);

    if (currentBytes + cost > maxBytes && current.length > 0) {
      pieces.push(current);
      current = '';
      currentBytes = 0;
    }

    current += character;
    currentBytes += cost;
  }

  pieces.push(current);
  return pieces;
}

/**
 * Wraps a store whose individual values are size-limited, making it accept values of any size.
 *
 * The wrapped store holds both the manifest and the chunks and needs no knowledge of either, which is
 * what lets the same decorator sit over the keychain on native and over nothing at all in a test.
 */
export function createChunkedStore(
  raw: KeyValueStore,
  maxBytes: number = DEFAULT_CHUNK_SIZE
): KeyValueStore {
  async function readManifest(key: string): Promise<Manifest | null> {
    const head = await raw.getItem(key);
    return head === null ? null : parseManifest(head);
  }

  /** Bounded by the count the manifest recorded, so it always terminates. */
  async function dropChunks(key: string, manifest: Manifest | null): Promise<void> {
    if (manifest === null) return;

    for (let index = 0; index < manifest.count; index += 1) {
      await raw.removeItem(chunkKey(key, manifest.generation, index));
    }
  }

  return {
    async getItem(key) {
      const head = await raw.getItem(key);
      if (head === null) return null;

      const manifest = parseManifest(head);
      // Content, not a manifest: a value short enough to be stored at the key itself.
      if (manifest === null) return head;

      const pieces: string[] = [];
      for (let index = 0; index < manifest.count; index += 1) {
        const piece = await raw.getItem(chunkKey(key, manifest.generation, index));

        // Fail closed — see the module docblock. A partial value here becomes a truncated JWT and an
        // unexplained auth failure; `null` becomes "signed out".
        if (piece === null) return null;

        pieces.push(piece);
      }

      return pieces.join('');
    },

    async setItem(key, value) {
      const previous = await readManifest(key);
      const pieces = splitByUtf8Bytes(value, maxBytes);

      if (pieces.length === 1) {
        // Writing the key *is* the commit, so it goes first and the sweep follows. Interrupted
        // before it, the previous manifest and its chunks are still intact and still read correctly.
        await raw.setItem(key, pieces[0] ?? '');
        await dropChunks(key, previous);
        return;
      }

      const generation = nextGeneration(previous);
      for (const [index, piece] of pieces.entries()) {
        await raw.setItem(chunkKey(key, generation, index), piece);
      }

      // The commit. Before this line a reader sees the previous value in full; after it, the new
      // value in full. There is no interleaving, because the two generations share no keys.
      await raw.setItem(key, formatManifest({ generation, count: pieces.length }));

      // Now unreferenced. Leaking these would be harmless for correctness — nothing points at them —
      // but they would sit in the keychain until the next write of this key reused those exact
      // indices, and a store that grows without bound is its own kind of bug.
      await dropChunks(key, previous);
    },

    async removeItem(key) {
      const manifest = await readManifest(key);

      // Chunks first. An interruption then leaves a manifest with missing chunks, which reads as
      // absent *and* still records where the survivors are, so the next write or delete can finish
      // the job. Removing the manifest first would orphan them with nothing left to find them by.
      await dropChunks(key, manifest);
      await raw.removeItem(key);
    },
  };
}

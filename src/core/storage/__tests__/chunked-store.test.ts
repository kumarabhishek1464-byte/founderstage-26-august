/**
 * The chunker's contract is *crash safety*, so this suite is mostly about interrupted writes.
 *
 * The reason the chunking lives in its own module — separate from `secure-store.ts` — is exactly
 * this: against the real keychain the interesting cases are unreachable, because a working keychain
 * never stops halfway. Against a fake that fails on a chosen write they are one line each.
 *
 * No mocking, no platform gating. The module has no native dependency, so all three Jest projects
 * run it identically and the fake below is the entire environment.
 *
 * The byte-length oracle below is deliberately *not* the implementation's own arithmetic.
 * `chunked-store.ts` computes UTF-8 costs by hand so it cannot depend on a global Hermes might not
 * have, which means checking it against that same function would be tautological. `TextEncoder`
 * would be the obvious independent oracle and is unavailable here — `jest-environment-jsdom` on the
 * Jest 29 line, which `jest-expo@57` pins, does not provide it, so the web project would fail on a
 * missing global rather than on anything about storage. `encodeURIComponent` is in the language
 * itself: it percent-escapes one `%XX` triplet per UTF-8 byte and leaves the unreserved ASCII set
 * alone, so collapsing each triplet to a single character yields an exact byte count.
 */
import { createChunkedStore, splitByUtf8Bytes } from '@/core/storage';

import type { KeyValueStore } from '@/core/storage';

function utf8Length(value: string): number {
  // Throws `URIError` on a lone surrogate, which is a legitimate outcome: a piece containing half a
  // surrogate pair is the corruption these tests exist to catch, and the suite asserts its absence
  // before measuring so the failure reads clearly.
  return encodeURIComponent(value).replace(/%[0-9A-F]{2}/gu, 'x').length;
}

interface FakeStore extends KeyValueStore {
  /** Every key currently holding a value, sorted, so assertions can be exact about leftovers. */
  readonly keys: () => readonly string[];
  /** Writes matching the predicate reject, simulating the process dying at that await. */
  readonly failWritesWhen: (predicate: (key: string) => boolean) => void;
}

/**
 * An in-memory `KeyValueStore` with no size limit of its own.
 *
 * Deliberately *not* size-limited: the chunker's job is to keep every value under `maxBytes`, and a
 * fake that enforced the limit would turn a chunking bug into a thrown error rather than into a
 * visibly wrong `keys()` snapshot. The tests assert the sizes themselves.
 */
function createFakeStore(): FakeStore {
  const data = new Map<string, string>();
  let shouldFail: (key: string) => boolean = () => false;

  return {
    getItem(key) {
      return Promise.resolve(data.get(key) ?? null);
    },
    setItem(key, value) {
      if (shouldFail(key)) return Promise.reject(new Error(`write to ${key} interrupted`));
      data.set(key, value);
      return Promise.resolve();
    },
    removeItem(key) {
      if (shouldFail(key)) return Promise.reject(new Error(`delete of ${key} interrupted`));
      data.delete(key);
      return Promise.resolve();
    },
    keys() {
      return [...data.keys()].sort();
    },
    failWritesWhen(predicate) {
      shouldFail = predicate;
    },
  };
}

const KEY = 'fs.auth.session';

/** Long enough to need several chunks at the small limits these tests use. */
function ascii(length: number): string {
  return 'x'.repeat(length);
}

describe('splitByUtf8Bytes', () => {
  it('returns a single empty piece for an empty string', () => {
    // Not `[]`. An empty value has to round-trip as an empty value, and a zero-piece result would
    // make `pieces.length === 1` false and produce a `count: 0` manifest — a state `parseManifest`
    // rejects, so the value would come back as `null` instead of `''`.
    expect(splitByUtf8Bytes('', 10)).toEqual(['']);
  });

  it('leaves a value that exactly fills the limit in one piece', () => {
    expect(splitByUtf8Bytes(ascii(10), 10)).toEqual([ascii(10)]);
  });

  it('splits at one byte over the limit', () => {
    expect(splitByUtf8Bytes(ascii(11), 10)).toEqual([ascii(10), 'x']);
  });

  it('measures bytes rather than code units for multi-byte characters', () => {
    // 'é' is one code unit and two UTF-8 bytes. A length-based split would fit five of them into a
    // 5-byte limit and produce a 10-byte chunk, which Android would then reject.
    const pieces = splitByUtf8Bytes('é'.repeat(5), 5);

    for (const piece of pieces) expect(utf8Length(piece)).toBeLessThanOrEqual(5);
    expect(pieces.join('')).toBe('é'.repeat(5));
  });

  it('never splits a surrogate pair', () => {
    // '👍' is two code units and four UTF-8 bytes. Slicing between its halves yields two lone
    // surrogates that encode as U+FFFD, so the value would rejoin *corrupt* rather than short — the
    // failure mode that a `String.length` split hides until a JWT stops parsing.
    const pieces = splitByUtf8Bytes('👍'.repeat(4), 6);

    expect(pieces.join('')).toBe('👍'.repeat(4));
    for (const piece of pieces) {
      expect(piece).not.toMatch(/[\uD800-\uDFFF]/u);
      expect(utf8Length(piece)).toBeLessThanOrEqual(6);
    }
  });

  it('packs a 4-byte character into the next piece rather than overflowing the current one', () => {
    // Three ASCII bytes then a 4-byte character, limit 6: the character cannot join the first piece.
    expect(splitByUtf8Bytes('abc👍', 6)).toEqual(['abc', '👍']);
  });
});

describe('createChunkedStore', () => {
  it('stores a value that fits at the key itself, with no manifest', async () => {
    const fake = createFakeStore();
    const store = createChunkedStore(fake, 100);

    await store.setItem(KEY, 'short');

    // One key, holding the value verbatim. This is what makes the decorator transparent for the
    // flags in `STORAGE_KEYS` — they must not pay two reads for the session's problem.
    expect(fake.keys()).toEqual([KEY]);
    await expect(store.getItem(KEY)).resolves.toBe('short');
  });

  it('round-trips a value far larger than the limit', async () => {
    const fake = createFakeStore();
    const store = createChunkedStore(fake, 10);
    const value = ascii(95);

    await store.setItem(KEY, value);

    expect(fake.keys()).toHaveLength(11); // 10 chunks plus the manifest.
    await expect(store.getItem(KEY)).resolves.toBe(value);
  });

  it('round-trips astral characters intact', async () => {
    const fake = createFakeStore();
    const store = createChunkedStore(fake, 7);
    const value = `{"t":"${'👍'.repeat(12)}"}`;

    await store.setItem(KEY, value);

    await expect(store.getItem(KEY)).resolves.toBe(value);
  });

  it('returns null for a key that was never written', async () => {
    const store = createChunkedStore(createFakeStore(), 10);

    await expect(store.getItem('fs.absent')).resolves.toBeNull();
  });

  it('keeps every chunk under the byte limit', async () => {
    const fake = createFakeStore();
    const store = createChunkedStore(fake, 12);

    await store.setItem(KEY, `${'é'.repeat(30)}👍${ascii(40)}`);

    // The manifest is excluded — it is metadata this module authors, and it is far shorter than any
    // limit. Every *chunk* is the thing the platform will reject.
    for (const key of fake.keys()) {
      if (key === KEY) continue;
      const chunk = await fake.getItem(key);
      expect(utf8Length(chunk ?? '')).toBeLessThanOrEqual(12);
    }
  });

  describe('failing closed', () => {
    it('returns null rather than a truncated value when a chunk is missing', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);
      await store.setItem(KEY, ascii(30));

      const [chunk] = fake.keys().filter((key) => key !== KEY);
      await fake.removeItem(chunk ?? '');

      // A truncated JWT would reach `supabase-js`, fail to parse, and surface as an opaque auth
      // error. `null` surfaces as "signed out", which is both correct and recoverable.
      await expect(store.getItem(KEY)).resolves.toBeNull();
    });

    it('treats a corrupt manifest as absent rather than as an empty value', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);

      // `count: 0` is not a state this module can produce — an empty string is one empty chunk — so
      // accepting it would let corruption read as a successful write of `''`.
      await fake.setItem(KEY, '__fs.chunked:a:0');

      await expect(store.getItem(KEY)).resolves.toBe('__fs.chunked:a:0');
    });

    it('round-trips an empty string', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);

      await store.setItem(KEY, '');

      await expect(store.getItem(KEY)).resolves.toBe('');
    });
  });

  describe('an interrupted write', () => {
    it('leaves the previous value fully readable', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);
      const original = ascii(30);
      await store.setItem(KEY, original);

      // Generation `a` is on disk, so the replacement writes `b`. Killing the process partway
      // through those writes is the case a same-key scheme gets wrong: with chunks reused and the
      // manifest written last, the old manifest would now point at a mixture of both values, the
      // counts would match, and the read would succeed with a corrupt session.
      fake.failWritesWhen((key) => key === `${KEY}.__b.2`);
      await expect(store.setItem(KEY, ascii(30).replace(/x/gu, 'y'))).rejects.toThrow(
        'interrupted'
      );

      fake.failWritesWhen(() => false);
      await expect(store.getItem(KEY)).resolves.toBe(original);
    });

    it('leaves the new value fully readable once the manifest has landed', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);
      await store.setItem(KEY, ascii(30));
      const replacement = 'y'.repeat(30);

      // Interrupt the sweep, which runs *after* the commit. The new value is authoritative from the
      // moment the manifest is replaced; the old generation's chunks are merely unreferenced.
      fake.failWritesWhen((key) => key.startsWith(`${KEY}.__a.`));
      await expect(store.setItem(KEY, replacement)).rejects.toThrow('interrupted');

      fake.failWritesWhen(() => false);
      await expect(store.getItem(KEY)).resolves.toBe(replacement);
    });

    it('reclaims the leaked chunks on the next write', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);
      await store.setItem(KEY, ascii(30));
      fake.failWritesWhen((key) => key.startsWith(`${KEY}.__a.`));
      await expect(store.setItem(KEY, 'y'.repeat(30))).rejects.toThrow('interrupted');
      fake.failWritesWhen(() => false);

      // Generation `b` holds the live value, so this write targets `a` — the exact keys the
      // interrupted sweep left behind. Alternating between two generations rather than
      // incrementing a counter is what bounds the leak to one set.
      await store.setItem(KEY, 'z'.repeat(30));

      expect(fake.keys()).toHaveLength(4); // 3 chunks plus the manifest; nothing stale.
      await expect(store.getItem(KEY)).resolves.toBe('z'.repeat(30));
    });
  });

  describe('replacing a value', () => {
    it('alternates generations so a write never touches live chunks', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);

      await store.setItem(KEY, ascii(30));
      const first = fake.keys().filter((key) => key !== KEY);
      await store.setItem(KEY, 'y'.repeat(30));
      const second = fake.keys().filter((key) => key !== KEY);

      expect(first.every((key) => key.includes('.__a.'))).toBe(true);
      expect(second.every((key) => key.includes('.__b.'))).toBe(true);
    });

    it('drops the chunks a shorter value no longer needs', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);
      await store.setItem(KEY, ascii(95));

      await store.setItem(KEY, ascii(25));

      // Left behind, these would sit in the keychain unreferenced — harmless for correctness, but a
      // store that grows on every token refresh is its own bug.
      expect(fake.keys()).toHaveLength(4);
      await expect(store.getItem(KEY)).resolves.toBe(ascii(25));
    });

    it('drops the chunks when a long value becomes a short one', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);
      await store.setItem(KEY, ascii(30));

      await store.setItem(KEY, 'short');

      expect(fake.keys()).toEqual([KEY]);
      await expect(store.getItem(KEY)).resolves.toBe('short');
    });

    it('chunks a value that has outgrown the limit', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);
      await store.setItem(KEY, 'short');

      await store.setItem(KEY, ascii(30));

      await expect(store.getItem(KEY)).resolves.toBe(ascii(30));
    });
  });

  describe('removing a value', () => {
    it('leaves nothing behind', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);
      await store.setItem(KEY, ascii(95));

      await store.removeItem(KEY);

      expect(fake.keys()).toEqual([]);
      await expect(store.getItem(KEY)).resolves.toBeNull();
    });

    it('is idempotent for a key that is not there', async () => {
      const store = createChunkedStore(createFakeStore(), 10);

      await expect(store.removeItem(KEY)).resolves.toBeUndefined();
    });

    it('reads as absent when interrupted partway', async () => {
      const fake = createFakeStore();
      const store = createChunkedStore(fake, 10);
      await store.setItem(KEY, ascii(30));

      fake.failWritesWhen((key) => key === `${KEY}.__a.2`);
      await expect(store.removeItem(KEY)).rejects.toThrow('interrupted');

      // Chunks are removed before the manifest precisely so this is the outcome: the manifest still
      // records where the survivors are, so a retry can finish the job, and meanwhile the read fails
      // closed. Removing the manifest first would orphan them with nothing left to find them by.
      fake.failWritesWhen(() => false);
      await expect(store.getItem(KEY)).resolves.toBeNull();
      await store.removeItem(KEY);
      expect(fake.keys()).toEqual([]);
    });
  });
});

/**
 * The `MessageCipher` port — the seam that keeps end-to-end encryption a later decision.
 *
 * Message bodies are stored as plaintext today (see `docs/CHAT_SECURITY.md` for the honest
 * trust boundary that implies). This port exists so that fact lives in **one** swappable
 * object rather than being spread across every read and write path.
 *
 * ## Why a port at all, if the only implementation is the identity function
 *
 * Retrofitting encryption into a messaging system that assumed plaintext is not a
 * refactor, it is a rewrite: every `select` that returned a `body` becomes a decrypt, every
 * insert becomes a seal, and the places that quietly assumed a readable body — search,
 * push previews, moderation — surface all at once as product decisions. Naming the boundary
 * now costs the ~30 lines below and turns that rewrite into implementing one interface.
 *
 * The port is deliberately shaped so a real cipher *fits*:
 *
 * - **`seal` and `open` are async.** A real implementation performs key agreement and may
 *   touch the keychain. If these were synchronous, every call site would need changing.
 * - **Both take a `conversationId`.** Encryption keys are per-conversation, never global.
 *   A signature without it would have to be widened later at every call site.
 * - **`open` receives the `contentEncoding` the row was written with**, not the one the app
 *   currently prefers. History does not re-encrypt itself: a conversation that predates the
 *   cutover keeps returning `plain` rows forever, so the reader must dispatch per row.
 * - **`open` returns a result, not a throw.** An undecryptable message is a normal state in
 *   any real E2EE system (missing device key, a session established after the message was
 *   sent), and it must render as one bubble saying so — not fail the whole page of results.
 *
 * ## What this port is not
 *
 * It is not transport security and not at-rest security for the database. TLS covers the
 * former, Supabase's disk encryption the latter. This is specifically about whether the
 * server can read a body, which is a different question with a different answer.
 */

/**
 * How a stored body is encoded. Persisted per message row in `messages.content_encoding`,
 * so this union is a database value and members may never be renamed — only added.
 *
 * `plain` is not a placeholder to be removed once encryption ships. Rows written before a
 * cutover stay `plain` permanently, and system messages ("Ana added Ben to the group") are
 * generated server-side and therefore cannot be sealed by a client at all.
 */
export const CONTENT_ENCODINGS = ['plain'] as const;

export type ContentEncoding = (typeof CONTENT_ENCODINGS)[number];

/**
 * Bumped when the *framing* of a sealed body changes in a way a reader must know about —
 * a new AEAD construction, a different header layout. Separate from `ContentEncoding`
 * because a scheme can revise its own format without becoming a different scheme, and a
 * reader needs to reject a version it does not understand rather than misparse it.
 */
export const PROTOCOL_VERSION = 1;

/** What a sealed body carries into the database. The three columns, together. */
export interface SealedBody {
  readonly body: string;
  readonly contentEncoding: ContentEncoding;
  readonly protocolVersion: number;
}

/**
 * The outcome of opening a stored body.
 *
 * A discriminated union rather than `string | null` because the failure has to be
 * distinguishable at the UI: "this message could not be decrypted for you" is a real
 * bubble with a real explanation, whereas an empty body is a legitimate value for a
 * message that carries only an attachment.
 */
export type OpenedBody =
  | { readonly ok: true; readonly body: string }
  /**
   * `reason` is developer-facing and goes to logs. It must never contain key material or
   * ciphertext — see the redaction rules in
   * [ADR-0016](../../../docs/adr/0016-logging-and-redaction.md).
   */
  | { readonly ok: false; readonly reason: string };

export interface SealRequest {
  readonly conversationId: string;
  readonly plaintext: string;
}

export interface OpenRequest {
  readonly conversationId: string;
  readonly body: string;
  /** The encoding **this row** was written with, read from the row. Never assumed. */
  readonly contentEncoding: ContentEncoding;
  readonly protocolVersion: number;
}

export interface MessageCipher {
  /**
   * The encoding this cipher writes. Read by the repository so the value stored in the row
   * and the value the cipher would produce cannot drift apart.
   */
  readonly encoding: ContentEncoding;

  seal(request: SealRequest): Promise<SealedBody>;
  open(request: OpenRequest): Promise<OpenedBody>;
}

/**
 * `PlainCipher` — the identity implementation of {@link MessageCipher}.
 *
 * Message bodies pass through unchanged. This is the current, deliberate posture: without
 * it there is no server-side search, no moderation of reported content, and no push preview
 * — three features the product wants and E2EE forecloses. `docs/CHAT_SECURITY.md` states
 * the trust boundary this creates rather than implying a stronger one.
 *
 * ## Why `open` still validates instead of just returning the body
 *
 * A row whose `content_encoding` is something this cipher does not write is not "probably
 * fine" — it is a row written by a *different* scheme, and returning its bytes as a message
 * body would render ciphertext (or, worse, a base64 blob that looks like a corrupted
 * message) into the conversation. Rejecting it produces the "cannot be shown" bubble the
 * union exists for, which is the honest answer and the one that survives a partial cutover.
 *
 * The same argument applies to `protocolVersion`: a future writer that changes the framing
 * bumps the version precisely so that older readers refuse rather than misparse.
 */
import { PROTOCOL_VERSION } from './message-cipher';

import type {
  ContentEncoding,
  MessageCipher,
  OpenedBody,
  OpenRequest,
  SealedBody,
  SealRequest,
} from './message-cipher';

const PLAIN: ContentEncoding = 'plain';

export function createPlainCipher(): MessageCipher {
  return {
    encoding: PLAIN,

    // `async` with no `await` would trip `require-await`; the port is async because a real
    // cipher must be, so the identity implementation resolves immediately instead.
    seal({ plaintext }: SealRequest): Promise<SealedBody> {
      return Promise.resolve({
        body: plaintext,
        contentEncoding: PLAIN,
        protocolVersion: PROTOCOL_VERSION,
      });
    },

    open({ body, contentEncoding, protocolVersion }: OpenRequest): Promise<OpenedBody> {
      if (contentEncoding !== PLAIN) {
        return Promise.resolve({
          ok: false,
          // `String(…)` because `ContentEncoding` currently has one member, so the negative
          // branch narrows to `never` and cannot be interpolated. The branch is still
          // reachable: the value comes from a database row, and a row written by a future
          // encoding is exactly what this check exists to reject.
          reason: `unsupported content encoding: ${String(contentEncoding)}`,
        });
      }

      if (protocolVersion > PROTOCOL_VERSION) {
        return Promise.resolve({
          ok: false,
          reason: `message written with protocol version ${String(protocolVersion)}, reader supports ${String(PROTOCOL_VERSION)}`,
        });
      }

      return Promise.resolve({ ok: true, body });
    },
  };
}

/**
 * The process-wide cipher.
 *
 * A module-level singleton rather than a provider: nothing in the app renders differently
 * per cipher, and a React context would put an encryption decision inside the component
 * tree where a test could accidentally omit it and get a silently different one. When a real
 * cipher lands, it is constructed here — one line, one place.
 */
export const messageCipher: MessageCipher = createPlainCipher();

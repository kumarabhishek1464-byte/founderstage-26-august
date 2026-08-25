/**
 * The cipher seam. See [ADR-0020](../../../docs/adr/0020-encryption-posture.md).
 *
 * Callers depend on `messageCipher` and on the types; nothing outside this directory
 * constructs a cipher, so replacing the implementation is a change to one file.
 */
export { CONTENT_ENCODINGS, PROTOCOL_VERSION } from './message-cipher';
export type {
  ContentEncoding,
  MessageCipher,
  OpenedBody,
  OpenRequest,
  SealedBody,
  SealRequest,
} from './message-cipher';
export { createPlainCipher, messageCipher } from './plain-cipher';

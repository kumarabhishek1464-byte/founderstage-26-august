/**
 * Messaging's identifiers.
 *
 * Separate from `@/core/ids` because these are domain identities that only messaging has —
 * core owns `UserId` because auth, analytics and storage all need it, and it would own
 * nothing else here without becoming a dumping ground for feature vocabulary.
 *
 * Every `as*` function is a cast, not a validation. See the reasoning on `asUserId` in
 * `@/core/ids`: these values come from rows RLS has already gated, and the casts exist so
 * that `grep -rn "asMessageId"` lists every point where an untyped string becomes a domain
 * id — which should be the mappers and nothing else.
 */
import type { Branded } from '@/core/ids';

export type ConversationId = Branded<string, 'ConversationId'>;
export type MessageId = Branded<string, 'MessageId'>;
export type AttachmentId = Branded<string, 'AttachmentId'>;
export type DeviceId = Branded<string, 'DeviceId'>;

/**
 * The idempotency key a client mints **before** sending, so a retry after an ambiguous
 * failure is provably the same message rather than a second one.
 *
 * Distinct from `MessageId` on purpose: this one is generated on the device, is meaningful
 * only within `(conversation_id, sender_id)`, and is the client's half of the unique
 * constraint that makes `send_message` idempotent. Conflating the two would let a caller
 * pass a server-assigned id as an idempotency key, which reads fine and silently breaks the
 * dedupe for every replay.
 */
export type ClientMessageId = Branded<string, 'ClientMessageId'>;

/**
 * A per-conversation monotonic sequence number.
 *
 * Branded because it is the load-bearing number in this feature — sort key, pagination
 * cursor, sync watermark and dedupe key all at once
 * ([ADR-0022](../../../../docs/adr/0022-ordering-and-sync.md)) — and because it is *not*
 * comparable across conversations. Conversation A's seq 50 and conversation B's seq 50 are
 * unrelated, so a bare `number` invites a cross-conversation comparison that is always wrong
 * and never obviously wrong.
 *
 * A `number`, not a `bigint`, despite the column being `bigint`: `Number.MAX_SAFE_INTEGER`
 * is 9.007e15, and a conversation would need to sustain a million messages a second for 285
 * years to reach it. `bigint` would cost JSON serialisation (which cannot represent it),
 * arithmetic interop, and every comparison site.
 */
export type Seq = Branded<number, 'Seq'>;

export function asConversationId(value: string): ConversationId {
  return value as ConversationId;
}

export function asMessageId(value: string): MessageId {
  return value as MessageId;
}

export function asAttachmentId(value: string): AttachmentId {
  return value as AttachmentId;
}

export function asDeviceId(value: string): DeviceId {
  return value as DeviceId;
}

export function asClientMessageId(value: string): ClientMessageId {
  return value as ClientMessageId;
}

export function asSeq(value: number): Seq {
  return value as Seq;
}

/**
 * The sentinel for "has read nothing".
 *
 * `seq` starts at 1, so 0 is unreachable as a real message and means the watermark
 * comparison `message.seq <= member.lastReadSeq` is false for every message without needing
 * a nullable column. A nullable watermark would push a `?? 0` into every comparison site,
 * and the one place it was forgotten would mark an entire conversation as read.
 */
export const NO_SEQ: Seq = 0 as Seq;

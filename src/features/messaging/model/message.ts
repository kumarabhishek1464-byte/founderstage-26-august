/**
 * A message, after mapping. This is what every component below the hooks receives.
 *
 * ## `seq` rather than `createdAt` is the identity of a position
 *
 * `createdAt` is recorded and displayed, and it is **never** used to order or paginate. Two
 * devices with 400ms of clock skew produce timestamps that interleave wrongly, and a device
 * with a badly wrong clock produces a message that sorts to the top of the thread forever.
 * `seq` is assigned by Postgres under a row lock, so it is total, gap-free per conversation,
 * and the same on every device. See [ADR-0022](../../../../docs/adr/0022-ordering-and-sync.md).
 *
 * ## Why `unavailable` collapses three different absences
 *
 * A body can be missing because the sender deleted it for everyone, because *this* user
 * deleted it for themselves, or because the cipher could not open it. The UI treatment is the
 * same shape in all three cases — a muted, italic, non-interactive bubble — and the only
 * difference is the sentence. One nullable discriminator gives the renderer one branch
 * instead of three, and makes "body present" a single check rather than a conjunction that
 * one call site will get wrong.
 *
 * `body` is `''` whenever `unavailable` is non-null. Both are stated so no consumer has to
 * infer one from the other.
 */
import type { DeliveryState, MessageKind, SystemEvent } from './enums';
import type { ClientMessageId, ConversationId, MessageId, Seq } from './ids';
import type { Attachment } from './attachment';
import type { Profile } from './profile';
import type { UserId } from '@/core/ids';

export type BodyUnavailableReason =
  /** The sender deleted it for everyone. Visible to all members as a tombstone. */
  | 'deleted'
  /** This user deleted their own copy. Nobody else sees a tombstone. */
  | 'deleted_for_me'
  /** The cipher rejected the row — a future encoding, or a key this device does not hold. */
  | 'undecryptable';

/**
 * Aggregated reactions for one emoji. Never a list of reaction rows: a popular message in a
 * 200-person group would ship 200 rows to render one pill with a count.
 */
export interface ReactionSummary {
  readonly emoji: string;
  readonly count: number;
  /** Drives the pill's `selected` state and makes the toggle a local decision. */
  readonly reactedByMe: boolean;
  /**
   * A bounded sample for the "Ana, Ben and 3 others" line — capped server-side, so this is
   * never proportional to `count`.
   */
  readonly sampleUserIds: readonly UserId[];
}

/**
 * The quoted message shown above a reply.
 *
 * A denormalised snapshot rather than a nested `Message`, for two reasons: a `Message` that
 * contains a `Message` is a recursive type that can nest arbitrarily deep in a reply chain,
 * and the quote is a *preview* — one line of text and at most a thumbnail — so shipping the
 * full parent to render it is pure waste on every page of history.
 */
export interface MessageReplyPreview {
  readonly id: MessageId;
  readonly seq: Seq;
  readonly senderId: UserId | null;
  readonly senderName: string | null;
  /** Truncated server-side. `null` when the parent is unavailable. */
  readonly excerpt: string | null;
  readonly kind: MessageKind;
}

/**
 * A system message's meaning, as data.
 *
 * `actorId` and `subjectId` rather than a rendered sentence — see the note on `SYSTEM_EVENTS`
 * in `enums.ts`. The renderer resolves names from the member list it already has, so the
 * sentence is always current and always in the reader's language.
 */
export interface SystemEventPayload {
  readonly event: SystemEvent;
  readonly actorId: UserId | null;
  readonly subjectId: UserId | null;
  /** For `title_changed` and `role_changed` — the new value, when a name is not enough. */
  readonly value: string | null;
}

export interface Message {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly seq: Seq;
  readonly kind: MessageKind;

  /** `null` exactly when `kind` is `system`. */
  readonly senderId: UserId | null;
  /**
   * Resolved sender. `null` for system messages, and also `null` for a member whose profile
   * has not loaded — which is why the bubble falls back to an initial-less avatar rather
   * than assuming presence.
   */
  readonly sender: Profile | null;

  readonly body: string;
  readonly unavailable: BodyUnavailableReason | null;

  /**
   * The sender's wall clock, displayed and never trusted for ordering. Kept because a
   * timestamp the server invented would be wrong in the other direction — a message composed
   * offline at 09:00 and delivered at 14:00 belongs at 09:00 in the thread's date separators.
   */
  readonly createdAt: string;
  /** Server time. Used for retention and for the "edited" mark's own timestamp. */
  readonly editedAt: string | null;

  readonly replyTo: MessageReplyPreview | null;
  readonly attachments: readonly Attachment[];
  readonly reactions: readonly ReactionSummary[];
  readonly mentions: readonly UserId[];
  readonly systemEvent: SystemEventPayload | null;

  readonly isPinned: boolean;

  /**
   * Derived on the client, never stored. `pending` and `failed` come from the outbox;
   * `sent`/`delivered`/`read` are computed from the other members' watermarks. Only
   * meaningful on your own messages — a message you received is always `read` by you.
   */
  readonly deliveryState: DeliveryState;

  /**
   * The idempotency key, present on messages this device sent in this session. It is what
   * lets an optimistic bubble be *replaced* by its server row rather than appearing twice
   * when the realtime echo and the mutation response race.
   */
  readonly clientMessageId: ClientMessageId | null;
}

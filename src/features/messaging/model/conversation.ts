/**
 * Conversations and membership.
 *
 * ## Why the viewer's own membership is a required field
 *
 * `Conversation.membership` is not nullable. You cannot read a conversation you were never a
 * member of — RLS makes that a denial, not an empty result — so a `Conversation` object
 * without a membership is not a state the system can produce. Typing it as nullable would
 * push a `?? ` or a `!` into every permission check, every unread calculation and every
 * notification-level read, for a case that cannot happen.
 *
 * ## Why `unreadCount` is on the conversation and not computed in the list
 *
 * It is `count(*) where seq > lastReadSeq`, which the database can answer from an index and
 * the client cannot answer at all without holding every message. §73's cost argument is the
 * whole reason read state is a watermark rather than per-message rows — see
 * [ADR-0029](../../../../docs/adr/0029-read-receipt-watermarks.md).
 */
import type {
  ConversationType,
  GroupRole,
  MembershipState,
  MessageKind,
  NotificationLevel,
} from './enums';
import type { ConversationId, MessageId, Seq } from './ids';
import type { ConversationPermissionOverrides } from './permission';
import type { Profile } from './profile';
import type { UserId } from '@/core/ids';

export interface ConversationMember {
  readonly conversationId: ConversationId;
  readonly userId: UserId;
  readonly role: GroupRole;
  readonly state: MembershipState;
  readonly joinedAt: string;
  /** Set when `state` is `left` or `removed`. Bounds this member's read access in RLS. */
  readonly leftAt: string | null;

  /**
   * The highest `seq` this member has read. Advanced by RPC, debounced client-side, and
   * **monotonic** — the RPC uses `greatest(last_read_seq, $1)` so an out-of-order call from a
   * slow network cannot un-read a conversation.
   */
  readonly lastReadSeq: Seq;
  /** Highest `seq` known to have reached this member's device. */
  readonly lastDeliveredSeq: Seq;

  readonly notificationLevel: NotificationLevel;
  readonly isPinned: boolean;
  readonly isArchived: boolean;

  /** `null` while the profile is still loading. */
  readonly profile: Profile | null;
}

/**
 * The one line under a conversation's name in the list.
 *
 * A flat snapshot rather than an embedded `Message`, because the list renders a hundred of
 * these and none of them needs reactions, mentions, attachments or a reply preview. Fetching
 * full messages to render a subtitle is the single most expensive mistake available in a
 * conversation list.
 */
export interface ConversationPreview {
  readonly messageId: MessageId;
  readonly seq: Seq;
  readonly kind: MessageKind;
  readonly senderId: UserId | null;
  readonly senderName: string | null;
  /**
   * Truncated server-side, and `null` when the message was deleted or is unopenable — the
   * list then renders "Message unavailable" rather than an empty second line.
   */
  readonly excerpt: string | null;
  readonly createdAt: string;
}

export interface Conversation {
  readonly id: ConversationId;
  readonly type: ConversationType;

  /**
   * `null` for `direct`, where the title is the other participant's name and is resolved at
   * render time. Storing a computed title on a DM would freeze the name at creation and show
   * a stale one after the other person renames themselves.
   */
  readonly title: string | null;
  readonly avatarUrl: string | null;
  readonly description: string | null;

  readonly createdBy: UserId;
  readonly createdAt: string;

  /** `null` for a group created but not yet posted in. Drives the list's sort. */
  readonly lastMessageAt: string | null;
  /** The conversation's highest assigned `seq`. The sync watermark's upper bound. */
  readonly lastSeq: Seq;

  readonly permissionOverrides: ConversationPermissionOverrides;

  /** The viewer's own row. See the docblock — never null. */
  readonly membership: ConversationMember;

  readonly memberCount: number;
  /**
   * Enough participants to render the header and the avatar cluster — both participants for a
   * DM, a bounded handful for a group. The full list is a separate query, because a
   * 200-person group must not ship 200 profiles to render a list row.
   */
  readonly participants: readonly Profile[];

  readonly lastMessage: ConversationPreview | null;
  readonly unreadCount: number;

  /**
   * A DM from someone the viewer has no prior connection to, held in the requests inbox until
   * accepted. §31: an unaccepted request must not generate a push notification and must not
   * appear in the main list — which is why this is a field on the conversation rather than a
   * separate table the list would have to left-join and could forget to.
   */
  readonly isRequest: boolean;
}

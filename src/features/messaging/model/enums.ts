/**
 * Every closed union in messaging, in one file.
 *
 * ## Why they are together rather than beside the types that use them
 *
 * `no-circular` is an **error** in `.dependency-cruiser.cjs`, and `tsPreCompilationDeps` is
 * on — so a type-only import is a graph edge and a cycle through types alone still fails the
 * build. The natural placement (roles beside `Conversation`, message kinds beside `Message`)
 * produces exactly that cycle the moment authorization needs a conversation type and a
 * conversation needs a permission override map. Hoisting the leaves into a module that
 * imports nothing removes the possibility rather than the current instance.
 *
 * ## Which of these the database owns
 *
 * Marked per union below. A value the database owns may be **added** to but never renamed or
 * reordered — the strings are stored in columns, and a rename is a migration, not an edit.
 * The two client-only unions (`DeliveryState`, `ConnectionState`) are free to change, and are
 * separated here so that distinction is visible at the point of change.
 */

/** Database: `messaging.conversation_type`. */
export const CONVERSATION_TYPES = ['direct', 'group'] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

/**
 * Database: `messaging.group_role`.
 *
 * Ordered weakest → strongest. The order is load-bearing: `roleRank` in `permission.ts` is
 * this array's index, so inserting a role in the middle re-ranks the ones after it. Append.
 *
 * `moderator` exists between `member` and `admin` because deleting someone else's message
 * and adding someone to the group are genuinely different powers — a large founder group
 * wants people who can clean up spam without also being able to restructure membership.
 */
export const GROUP_ROLES = ['member', 'moderator', 'admin', 'owner'] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

/**
 * Database: `messaging.membership_state`.
 *
 * `left` and `removed` are distinct because the product treats them differently — a user who
 * left may rejoin an open group on their own, a user who was removed may not — and because
 * conflating them loses the only record of which happened once `group_membership_events` is
 * pruned.
 *
 * A non-`active` member keeps read access to history up to `left_at` and gets nothing after
 * it. That is enforced in RLS, not here.
 */
export const MEMBERSHIP_STATES = ['active', 'left', 'removed'] as const;
export type MembershipState = (typeof MEMBERSHIP_STATES)[number];

/** Database: `messaging.notification_level`. Per-member, per-conversation. */
export const NOTIFICATION_LEVELS = ['all', 'mentions', 'none'] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

/**
 * Database: `messaging.message_kind`.
 *
 * `system` is the one that changes how everything reads it. A system message has no sender to
 * attribute, cannot be edited, replied to, reacted to or deleted, and its body is generated
 * by the database rather than sealed by a client — so `MessageCipher` never touches it. It
 * renders as centred grey text, not as a bubble. Every one of those is a branch that would
 * otherwise be inferred from `sender_id is null`, which is the same information carried less
 * explicitly.
 */
export const MESSAGE_KINDS = ['text', 'attachment', 'voice', 'system'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/**
 * Database: `messaging.system_event`.
 *
 * The system message's payload is this discriminator plus a small JSON object of actor and
 * subject ids — never a rendered sentence. Storing "Ana added Ben" would freeze the wording
 * and the language at write time and would embed display names that later change.
 */
export const SYSTEM_EVENTS = [
  'group_created',
  'member_added',
  'member_removed',
  'member_left',
  'member_joined',
  'role_changed',
  'title_changed',
  'avatar_changed',
  'permissions_changed',
] as const;
export type SystemEvent = (typeof SYSTEM_EVENTS)[number];

/** Database: `messaging.attachment_kind`. Drives the bubble shape and the validation rules. */
export const ATTACHMENT_KINDS = ['image', 'video', 'audio', 'document'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

/** Database: `messaging.report_reason`. */
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'impersonation',
  'inappropriate_content',
  'scam',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * **Client-only.** The lifecycle of one outgoing message as the sending device sees it.
 *
 * Never stored server-side. The server knows a message exists (`sent`) and knows every
 * member's `last_delivered_seq` and `last_read_seq`, from which `delivered` and `read` are
 * *derived* — see [ADR-0029](../../../../docs/adr/0029-read-receipt-watermarks.md). The two
 * states the server cannot know are the two that matter most to the composer:
 *
 * - `pending` — in the outbox, not yet acknowledged. Rendered with a clock glyph.
 * - `failed` — the send was rejected non-retryably, or retries were exhausted. Rendered with
 *   a retry affordance. Distinct from `pending` because a message that will never send on its
 *   own must not look like one that is about to.
 *
 * Ordered by progression, which `delivery-state.ts` relies on to reject regressions.
 */
export const DELIVERY_STATES = ['pending', 'sent', 'delivered', 'read', 'failed'] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

/**
 * **Client-only.** What the conversation header shows about the socket.
 *
 * Deliberately coarser than `RealtimeStatus` in `@/core/realtime`: that union has five members
 * because a subscription manager needs to distinguish them, and this one has three because a
 * user does not. Mapping happens once, in the realtime bindings.
 */
export const CONNECTION_STATES = ['online', 'connecting', 'offline'] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

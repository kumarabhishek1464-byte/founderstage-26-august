/**
 * The messaging repository. Every table read and every mutation the messaging surface performs is
 * one of these calls; nothing else in the feature reaches the Supabase client.
 *
 * ## Why every read is an RPC and not a table select
 *
 * The inbox row is a join across `messaging_conversations`, `messaging_conversation_members`,
 * `messaging_messages` and `profiles`. Assembling that on the client is three round-trips and a
 * client-side aggregation that ships a full membership row per conversation; assembling it in a
 * SECURITY DEFINER RPC is one round-trip whose caller does not learn the schema. It is also the
 * only shape that survives an eventual second surface (a desktop web build, a native widget)
 * without duplicating the join logic.
 *
 * ## Why writes are RPCs too
 *
 * The tables have SELECT policies and no INSERT/UPDATE/DELETE policies at all — the migration
 * routes every mutation through a function that can authorize the specific operation. Adding a
 * "cannot send while muted" rule is one function to change rather than a policy table to reason
 * through.
 */
import { supabase } from '@/core/database/client';
import { createRepositoryQuery } from '@/core/query';

/**
 * The raw shape the `messaging_inbox_list` RPC returns. Kept explicit rather than derived from
 * generated types because the RPC's return is a `jsonb` blob — `supabase-js` cannot infer it,
 * and the alternative (`as any`) hides a schema drift until it renders wrong.
 */
export interface InboxItemDTO {
  readonly id: string;
  readonly type: 'direct' | 'group';
  readonly title: string | null;
  readonly avatar_url: string | null;
  readonly description: string | null;
  readonly last_message_at: string | null;
  readonly last_seq: number;
  readonly is_pinned: boolean;
  readonly is_muted: boolean;
  readonly is_archived: boolean;
  readonly last_read_seq: number;
  readonly role: 'member' | 'moderator' | 'admin' | 'owner';
  readonly notification_level: 'all' | 'mentions' | 'none';
  readonly unread_count: number;
  readonly last_message: {
    readonly body: string;
    readonly kind: 'text' | 'attachment' | 'voice' | 'system';
    readonly sender_id: string | null;
    readonly created_at: string;
    readonly deleted: boolean;
  } | null;
  readonly partners: readonly {
    readonly user_id: string;
    readonly name: string;
    readonly avatar_url: string | null;
  }[];
  readonly member_count: number;
}

/**
 * File attachment metadata carried on `messaging_messages.attachment`. The `storage_path` is empty
 * for seeded content and populated when a real upload flow lands.
 */
export interface AttachmentDTO {
  readonly name: string;
  readonly size: number;
  readonly mime: string;
  readonly storage_path?: string;
  readonly thumbnail_url?: string;
}

export interface ReactionDTO {
  readonly emoji: string;
  readonly count: number;
  /** Whether the current viewer reacted with this emoji — used to render the pill as selected. */
  readonly mine: boolean;
}

export interface ReplyContextDTO {
  readonly seq: number;
  readonly sender_id: string | null;
  readonly body: string;
  readonly deleted: boolean;
}

export interface ThreadMessageDTO {
  readonly id: string;
  readonly seq: number;
  readonly sender_id: string | null;
  readonly kind: 'text' | 'attachment' | 'voice' | 'system';
  readonly body: string;
  readonly created_at: string;
  readonly edited_at: string | null;
  readonly deleted: boolean;
  readonly reply_to_seq: number | null;
  readonly reply_to: ReplyContextDTO | null;
  readonly reactions: readonly ReactionDTO[];
  readonly attachment: AttachmentDTO | null;
  /** Optimistic-only. `true` while a mutation is in flight; cleared once the server confirms. */
  readonly pending?: boolean;
  /** Optimistic-only. Set when the send mutation errored so the UI can offer a retry. */
  readonly failed?: boolean;
}

export interface ThreadPartnerDTO {
  readonly user_id: string;
  readonly name: string;
  readonly avatar_url: string | null;
  readonly presence: 'online' | 'offline' | 'unknown';
}

export interface ThreadPageDTO {
  readonly me_user_id: string;
  readonly partner: ThreadPartnerDTO | null;
  readonly conversation: {
    readonly id: string;
    readonly type: 'direct' | 'group';
    readonly title: string | null;
    readonly last_seq: number;
  };
  readonly last_read_seq: number;
  readonly has_more: boolean;
  readonly messages: readonly ThreadMessageDTO[];
}

/**
 * The `messaging_send_message` RPC returns the newly-persisted row, so the optimistic slot in the
 * cache can be reconciled against a real id and a real seq in one round-trip. `attachment` and
 * `reply_to_seq` mirror the arguments the caller supplied.
 */
export interface SentMessageDTO {
  readonly id: string;
  readonly seq: number;
  readonly sender_id: string;
  readonly kind: 'text' | 'attachment' | 'voice';
  readonly body: string;
  readonly created_at: string;
  readonly reply_to_seq: number | null;
  readonly attachment: AttachmentDTO | null;
}

export const messagingRepository = {
  /**
   * Fetches the caller's inbox. Empty list is a valid, first-class result — the RPC returns
   * `[]` when there are no memberships rather than `null`, so the caller has one shape to render.
   */
  inbox: createRepositoryQuery('messaging.inbox', async (): Promise<readonly InboxItemDTO[]> => {
    const { data, error } = await supabase.rpc('messaging_inbox_list');
    if (error !== null) throw error;
    return (data as readonly InboxItemDTO[] | null) ?? [];
  }),

  /**
   * Idempotent seeder for the demo inbox. Called once from the empty state so the reference
   * design language has real conversations to render on top of. A no-op on any subsequent call.
   */
  seedDemo: createRepositoryQuery('messaging.seedDemo', async (): Promise<void> => {
    const { error } = await supabase.rpc('messaging_seed_demo');
    if (error !== null) throw error;
  }),

  /**
   * Bumps this member's read watermark for one conversation. The RPC uses `greatest()` so a slow
   * retry cannot un-read anything.
   */
  markRead: createRepositoryQuery(
    'messaging.markRead',
    async (input: { readonly conversationId: string; readonly upToSeq: number }): Promise<void> => {
      const { error } = await supabase.rpc('messaging_mark_read', {
        cid: input.conversationId,
        up_to_seq: input.upToSeq,
      });
      if (error !== null) throw error;
    }
  ),

  /**
   * Fetches one page of a conversation's messages, newest-page-first when `beforeSeq` is null.
   * The RPC also returns partner info, my read watermark and a `has_more` flag so the client can
   * render the whole surface in one round-trip.
   */
  threadPage: createRepositoryQuery(
    'messaging.threadPage',
    async (input: {
      readonly conversationId: string;
      readonly beforeSeq: number | null;
      readonly limit: number;
    }): Promise<ThreadPageDTO> => {
      const { data, error } = await supabase.rpc('messaging_thread_page', {
        cid: input.conversationId,
        before_seq: input.beforeSeq,
        limit_in: input.limit,
      });
      if (error !== null) throw error;
      return data as unknown as ThreadPageDTO;
    }
  ),

  /**
   * Sends a text message. The RPC allocates the next `seq` atomically under the conversation's
   * row lock, so a concurrent send from the same user (double-tap on Send, replay after a network
   * blip) cannot collide.
   */
  sendMessage: createRepositoryQuery(
    'messaging.sendMessage',
    async (input: {
      readonly conversationId: string;
      readonly body: string;
      readonly replyToSeq: number | null;
    }): Promise<SentMessageDTO> => {
      const { data, error } = await supabase.rpc('messaging_send_message', {
        cid: input.conversationId,
        body_in: input.body,
        reply_to_seq_in: input.replyToSeq,
      });
      if (error !== null) throw error;
      return data as unknown as SentMessageDTO;
    }
  ),

  /**
   * Toggles one emoji reaction on a message for the current viewer. Idempotent server-side, so a
   * duplicate tap is a safe no-op.
   */
  toggleReaction: createRepositoryQuery(
    'messaging.toggleReaction',
    async (input: { readonly messageId: string; readonly emoji: string }): Promise<void> => {
      const { error } = await supabase.rpc('messaging_toggle_reaction', {
        msg_id: input.messageId,
        emoji_in: input.emoji,
      });
      if (error !== null) throw error;
    }
  ),
};

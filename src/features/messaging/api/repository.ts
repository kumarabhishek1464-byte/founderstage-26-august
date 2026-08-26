/**
 * The messaging repository. Everything the inbox screen learns about the backend goes through
 * exactly these four calls; nothing else in the feature reaches the Supabase client.
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

export const messagingRepository = {
  /**
   * Fetches the caller's inbox. Empty list is a valid, first-class result — the RPC returns
   * `[]` when there are no memberships rather than `null`, so the caller has one shape to render.
   */
  inbox: createRepositoryQuery('messaging.inbox', async (): Promise<readonly InboxItemDTO[]> => {
    const { data, error } = await supabase.rpc('messaging_inbox_list');
    if (error !== null) throw error;
    // The RPC signature returns `jsonb`, which supabase-js hands back as `unknown`.
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
   * retry cannot un-read anything — see the `Message.seq` docblock for the ordering argument.
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
};

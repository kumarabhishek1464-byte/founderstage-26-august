/**
 * `useThread` — the thread page cache + the two mutations the 1-to-1 chat needs.
 *
 * ## One query, `feed` tier
 *
 * The thread page RPC is what the screen renders. It goes into `['messaging', 'thread', cid]` and
 * uses the `feed` cache tier — a 30-second staleness with a 5-minute in-memory retention. That
 * gcTime is what lets a user tap into a conversation, back out, and come back to a *rendered*
 * thread instead of a skeleton, which is what a mature chat surface has to feel like.
 *
 * ## Optimistic UI, kept honest
 *
 * `useSendMessage` writes an optimistic slot before the round-trip so the outgoing bubble appears
 * the instant the user hits Send. The slot carries a `pending: true` flag until the server
 * responds; on success the RPC's returned row replaces it (real id, real seq, real timestamp) and
 * the inbox query is invalidated so the last-message preview refreshes. On error we mark the slot
 * `failed: true` rather than removing it, so the user still sees what they typed and a retry
 * affordance can attach to that row.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cachePolicy } from '@/core/query';

import { messagingRepository } from '../api/repository';

import type { SentMessageDTO, ThreadMessageDTO, ThreadPageDTO } from '../api/repository';

/** Query key for one conversation's rendered thread. */
const threadKey = (conversationId: string) => ['messaging', 'thread', conversationId] as const;

/** Query key for the inbox — invalidated on send so the last-message preview refreshes. */
const INBOX_KEY = ['messaging', 'inbox'] as const;

/**
 * The latest 100 messages of a conversation, plus partner info and read state. Pagination past
 * that is a follow-up — this hook returns a single page today, and the RPC already accepts a
 * `beforeSeq` cursor for the day the scroll-up flow lands.
 */
export function useThread(conversationId: string) {
  return useQuery({
    queryKey: threadKey(conversationId),
    queryFn: () => messagingRepository.threadPage({ conversationId, beforeSeq: null, limit: 100 }),
    enabled: conversationId.length > 0,
    ...cachePolicy('feed'),
  });
}

interface SendVariables {
  readonly body: string;
  readonly replyToSeq: number | null;
  /**
   * Locally-generated identifier used to reconcile the optimistic slot with the server row when
   * the mutation resolves. Prefixed with `optim:` so it is impossible to confuse with a UUID.
   */
  readonly tempId: string;
}

interface SendContext {
  readonly previous: ThreadPageDTO | undefined;
}

/**
 * `useSendMessage` — appends the outgoing message to the cache immediately, then reconciles when
 * the RPC returns. `pending` on the slot drives the "sending" tick in the message footer; the
 * inbox query is invalidated on success so the row's last-message preview and its timestamp
 * refresh without an extra fetch here.
 */
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();

  return useMutation<SentMessageDTO, unknown, SendVariables, SendContext>({
    mutationFn: (input) =>
      messagingRepository.sendMessage({
        conversationId,
        body: input.body,
        replyToSeq: input.replyToSeq,
      }),

    onMutate: async (input) => {
      const key = threadKey(conversationId);
      // Cancel in-flight refetches so they cannot overwrite our optimistic slot.
      await qc.cancelQueries({ queryKey: key });

      const previous = qc.getQueryData<ThreadPageDTO>(key);
      if (previous === undefined) return { previous };

      // Seq for the optimistic slot: one past the newest we know about. On success the real seq
      // replaces this, but until then a "temporary" seq keeps `sort by seq` monotonic.
      const highestSeq = previous.messages.reduce(
        (max, m) => (m.seq > max ? m.seq : max),
        previous.conversation.last_seq
      );

      const optimistic: ThreadMessageDTO = {
        id: input.tempId,
        seq: highestSeq + 1,
        sender_id: previous.me_user_id,
        kind: 'text',
        body: input.body,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted: false,
        reply_to_seq: input.replyToSeq,
        reply_to:
          input.replyToSeq !== null
            ? (previous.messages.find((m) => m.seq === input.replyToSeq) ?? null) &&
              buildReplyContext(previous.messages, input.replyToSeq)
            : null,
        reactions: [],
        attachment: null,
        pending: true,
      };

      qc.setQueryData<ThreadPageDTO>(key, {
        ...previous,
        messages: [...previous.messages, optimistic],
      });

      return { previous };
    },

    onError: (_error, input, context) => {
      const key = threadKey(conversationId);
      // Do not roll the whole cache back — that would erase the message the user typed. Mark the
      // optimistic slot as failed so the UI can offer a retry against that specific row.
      qc.setQueryData<ThreadPageDTO>(key, (cur) =>
        cur === undefined
          ? cur
          : {
              ...cur,
              messages: cur.messages.map((m) =>
                m.id === input.tempId ? { ...m, pending: false, failed: true } : m
              ),
            }
      );
      // Silence the unused-context warning while keeping the parameter position stable in case
      // we later swap to a full rollback.
      void context;
    },

    onSuccess: (data, input) => {
      const key = threadKey(conversationId);
      qc.setQueryData<ThreadPageDTO>(key, (cur) => {
        if (cur === undefined) return cur;
        // Replace the optimistic slot with the server row: real id, real seq, real timestamp.
        const nextMessages = cur.messages.map((m) =>
          m.id === input.tempId
            ? {
                ...m,
                id: data.id,
                seq: data.seq,
                created_at: data.created_at,
                pending: false,
                failed: false,
              }
            : m
        );
        return {
          ...cur,
          messages: nextMessages,
          conversation: { ...cur.conversation, last_seq: data.seq },
          last_read_seq: Math.max(cur.last_read_seq, data.seq),
        };
      });
      // The inbox row's preview and timestamp depend on this convo's latest message — refresh so
      // the list surface stays in step with what the user just sent.
      void qc.invalidateQueries({ queryKey: INBOX_KEY });
    },
  });
}

/**
 * `useToggleReaction` — optimistically toggles one emoji reaction on a message, then confirms
 * against the server. Same reason as sends: a reaction that takes 200ms to appear feels broken.
 */
export function useToggleReaction(conversationId: string) {
  const qc = useQueryClient();

  return useMutation<
    void,
    unknown,
    { readonly messageId: string; readonly emoji: string },
    { readonly previous: ThreadPageDTO | undefined }
  >({
    mutationFn: (input) => messagingRepository.toggleReaction(input),

    onMutate: async (input) => {
      const key = threadKey(conversationId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ThreadPageDTO>(key);
      if (previous === undefined) return { previous };

      qc.setQueryData<ThreadPageDTO>(key, {
        ...previous,
        messages: previous.messages.map((m) =>
          m.id === input.messageId ? { ...m, reactions: toggle(m.reactions, input.emoji) } : m
        ),
      });

      return { previous };
    },

    onError: (_error, _input, context) => {
      const key = threadKey(conversationId);
      if (context?.previous !== undefined) qc.setQueryData(key, context.previous);
    },

    onSettled: () => {
      // Reconcile against the server so an unexpected collision (two devices tapping different
      // emojis on the same message) settles to the truth.
      void qc.invalidateQueries({ queryKey: threadKey(conversationId) });
    },
  });
}

/**
 * Toggles `emoji` in a reactions array against the current viewer. Kept pure so it is one unit
 * test rather than a re-render check.
 */
function toggle(
  reactions: readonly ThreadMessageDTO['reactions'][number][],
  emoji: string
): readonly ThreadMessageDTO['reactions'][number][] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (existing === undefined) {
    return [...reactions, { emoji, count: 1, mine: true }];
  }
  if (existing.mine) {
    const nextCount = existing.count - 1;
    if (nextCount <= 0) return reactions.filter((r) => r.emoji !== emoji);
    return reactions.map((r) => (r.emoji === emoji ? { ...r, count: nextCount, mine: false } : r));
  }
  return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
}

function buildReplyContext(
  messages: readonly ThreadMessageDTO[],
  seq: number
): ThreadMessageDTO['reply_to'] {
  const target = messages.find((m) => m.seq === seq);
  if (target === undefined) return null;
  return {
    seq: target.seq,
    sender_id: target.sender_id,
    body: target.body,
    deleted: target.deleted,
  };
}

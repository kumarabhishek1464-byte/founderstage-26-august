/**
 * `useInbox` — the one hook the chat surface uses to read conversations.
 *
 * Wrapped through `createRepositoryQuery` in `../api/repository.ts`; here we only pick the cache
 * tier and thread the meta the persister uses. `list` is the right tier: the inbox is
 * user-specific (so must not persist to disk) and has to feel live (so a 30-second staleness is
 * the ceiling).
 */
import { useQuery } from '@tanstack/react-query';

import { cachePolicy } from '@/core/query';

import { messagingRepository } from '../api/repository';

import type { InboxItemDTO } from '../api/repository';

const INBOX_KEY = ['messaging', 'inbox'] as const;

export function useInbox() {
  return useQuery({
    queryKey: INBOX_KEY,
    queryFn: () => messagingRepository.inbox(),
    ...cachePolicy('list'),
  });
}

/**
 * `useSeedDemo` — a one-shot side-effect the empty state fires so the reference design has data
 * to render. Idempotent server-side, so re-invoking it is safe.
 */
export function useSeedDemo() {
  return {
    seed: () => messagingRepository.seedDemo(),
  };
}

export type InboxItem = InboxItemDTO;

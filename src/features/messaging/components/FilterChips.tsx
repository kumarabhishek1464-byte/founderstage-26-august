/**
 * `FilterChips` — the horizontal row of segment filters that sits above the inbox.
 *
 * Five states — All, Unread, DMs, Groups, Mentions — modelled as a controlled `filter` prop plus an
 * `onFilterChange` callback, because the filter is a screen fact and not a chip fact. If the chip
 * held its own selection state, opening a conversation and coming back would silently reset the
 * inbox to All — an invisible loss of context the design language would call rude.
 *
 * ## Why we do not scroll
 *
 * The five labels fit in a mobile viewport at `Chip size="md"`. A ScrollView here would gain
 * nothing at phone width and add a horizontal gesture that competes with the tab swipe on iOS. If a
 * sixth state ever arrives, this stops fitting and the wrap becomes a horizontal scroll — but not
 * before.
 */
import { Chip, Stack } from '@/core/design-system';

export type InboxFilter = 'all' | 'unread' | 'direct' | 'group' | 'mentions';

interface FilterChipsProps {
  readonly filter: InboxFilter;
  readonly onFilterChange: (next: InboxFilter) => void;
}

/**
 * The order is meaningful: it runs from most-inclusive to most-scoped. All → Unread narrows by
 * state, then DMs and Groups narrow by kind, then Mentions narrows by an addressee. A user reading
 * the row left-to-right is reading a funnel.
 */
const FILTERS: readonly { readonly id: InboxFilter; readonly label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'direct', label: 'DMs' },
  { id: 'group', label: 'Groups' },
  { id: 'mentions', label: 'Mentions' },
];

export function FilterChips({ filter, onFilterChange }: FilterChipsProps) {
  return (
    <Stack direction="row" gap="xs" wrap>
      {FILTERS.map((f) => (
        <Chip
          key={f.id}
          label={f.label}
          selected={filter === f.id}
          onPress={() => {
            onFilterChange(f.id);
          }}
        />
      ))}
    </Stack>
  );
}

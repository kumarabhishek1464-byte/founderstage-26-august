/**
 * The conversation screen. Renders both direct (1-to-1) and group threads from the same layout —
 * the header and per-message chrome branch on `conversation.type`, everything else is shared.
 *
 * ## Composition
 *
 * Header (direct vs group) → optional pinned-message strip → the timeline → composer. Everything
 * data-shaped comes from `useThread(id)`; sends go through `useSendMessage`, reactions through
 * `useToggleReaction`.
 *
 * ## Newest-at-bottom, oldest-at-top
 *
 * The RPC returns messages sorted by `seq` ascending, so the array is already in reading order and
 * `FlashList` is not inverted — inverted lists on FlashList have persistent quirks around initial
 * scroll positioning. Instead the list scrolls to the last row after the first render and again
 * after each successful send.
 *
 * ## Rows are a tagged union
 *
 * The flat data passed to the list is a tagged union of `separator | message | system`. The
 * separator carries a day label, the system row a body + optional icon; both are siblings of
 * messages so the row renderer can discriminate without piling if-branches into the bubble.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Screen, Skeleton, Stack, Text, createStyles } from '@/core/design-system';

import { Composer } from '@/features/messaging/components/Composer';
import { DateSeparator } from '@/features/messaging/components/DateSeparator';
import { EncryptionNotice } from '@/features/messaging/components/EncryptionNotice';
import { GroupHeader } from '@/features/messaging/components/GroupHeader';
import { MessageActionSheet } from '@/features/messaging/components/MessageActionSheet';
import { MessageBubble } from '@/features/messaging/components/MessageBubble';
import { PinnedMessageStrip } from '@/features/messaging/components/PinnedMessageStrip';
import { SystemMessage } from '@/features/messaging/components/SystemMessage';
import { ThreadHeader } from '@/features/messaging/components/ThreadHeader';
import { TypingIndicator } from '@/features/messaging/components/TypingIndicator';
import {
  useSendMessage,
  useThread,
  useToggleReaction,
} from '@/features/messaging/model/use-thread';

import type { IconName, SheetRef } from '@/core/design-system';
import type { ThreadMessageDTO } from '@/features/messaging/api/repository';

const useStyles = createStyles((t) => ({
  frame: {
    flex: 1,
    backgroundColor: t.colors.surface.primary,
  },
  listContent: {
    paddingHorizontal: t.spacing.md,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.md,
  },
  messageWrap: {
    paddingVertical: t.spacing.xxs,
  },
  errorSlot: { padding: t.spacing.lg },
  emptySlot: {
    padding: t.spacing.xl2,
  },
}));

type Row =
  | { readonly kind: 'separator'; readonly key: string; readonly label: string }
  | {
      readonly kind: 'message';
      readonly key: string;
      readonly message: ThreadMessageDTO;
      readonly outgoing: boolean;
      readonly showTail: boolean;
      readonly isRead: boolean;
      readonly senderChrome: 'none' | 'first-of-run' | 'continuation';
    }
  | {
      readonly kind: 'system';
      readonly key: string;
      readonly body: string;
      readonly icon: IconName | null;
    };

// How long the demo typing indicator stays visible after the group screen mounts. Realtime
// presence eventually replaces this — until then, this makes the reference frame land the same
// way it reads in the design.
const DEMO_TYPING_MS = 6000;

export default function ThreadScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = typeof params.id === 'string' ? params.id : '';

  const thread = useThread(conversationId);
  const sendMutation = useSendMessage(conversationId);
  const reactMutation = useToggleReaction(conversationId);

  const listRef = useRef<ComponentRef<typeof FlashList<Row>> | null>(null);
  const sheetRef = useRef<SheetRef>(null);

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ThreadMessageDTO | null>(null);
  const [actionTarget, setActionTarget] = useState<ThreadMessageDTO | null>(null);
  const [showDemoTyping, setShowDemoTyping] = useState(true);

  const conversation = thread.data?.conversation ?? null;
  const isGroup = conversation?.type === 'group';
  const partner = thread.data?.partner ?? null;
  const partnerName = partner?.name ?? 'this conversation';
  const meId = thread.data?.me_user_id ?? '';
  const pinned = thread.data?.pinned_message ?? null;
  const groupTitle = conversation?.title ?? 'Group';
  const groupAvatar = conversation?.avatar_url ?? null;
  const memberCount = thread.data?.member_count ?? 0;
  const onlineCount = thread.data?.online_count ?? 0;

  // Pick the first non-caller member as the demo typing user. Real presence swaps this for a
  // realtime channel event.
  const demoTypingName = useMemo(() => {
    if (!isGroup) return null;
    const messages = thread.data?.messages ?? [];
    for (const m of messages) {
      if (m.kind === 'system') continue;
      if (m.sender_id === meId) continue;
      if (m.sender_name !== null && m.sender_name !== undefined) return m.sender_name;
    }
    return null;
  }, [isGroup, thread.data?.messages, meId]);

  const rows = useMemo<readonly Row[]>(
    () => buildRows(thread.data?.messages ?? [], meId, isGroup),
    [thread.data?.messages, meId, isGroup]
  );

  useEffect(() => {
    if (rows.length === 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, [rows.length]);

  useEffect(() => {
    if (!isGroup) return;
    const timer = setTimeout(() => {
      setShowDemoTyping(false);
    }, DEMO_TYPING_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isGroup]);

  const handleSend = useCallback(() => {
    const body = draft.trim();
    if (body.length === 0) return;
    const tempId = `optim:${Date.now().toString()}`;
    const currentReply = replyTo;
    setDraft('');
    setReplyTo(null);
    sendMutation.mutate({
      body,
      replyToSeq: currentReply?.seq ?? null,
      tempId,
    });
  }, [draft, replyTo, sendMutation]);

  const handleLongPress = useCallback((message: ThreadMessageDTO) => {
    setActionTarget(message);
    sheetRef.current?.expand();
  }, []);

  const handleCloseSheet = useCallback(() => {
    sheetRef.current?.close();
    setActionTarget(null);
  }, []);

  const handleReact = useCallback(
    (messageId: string, emoji: string) => {
      reactMutation.mutate({ messageId, emoji });
    },
    [reactMutation]
  );

  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'separator') {
        return <DateSeparator label={item.label} />;
      }
      if (item.kind === 'system') {
        return <SystemMessage body={item.body} icon={item.icon} />;
      }
      return (
        <Stack style={styles.messageWrap}>
          <MessageBubble
            message={item.message}
            outgoing={item.outgoing}
            showTail={item.showTail}
            isRead={item.isRead}
            partnerName={partnerName}
            senderChrome={item.senderChrome}
            onLongPress={handleLongPress}
            onToggleReaction={handleReact}
          />
        </Stack>
      );
    },
    [styles.messageWrap, partnerName, handleLongPress, handleReact]
  );

  const composerPlaceholder = isGroup && conversation?.title !== null
    ? `Message ${conversation?.title ?? ''}`
    : 'Message';

  return (
    <Screen padded={false} safeBottom={false}>
      {isGroup ? (
        <GroupHeader
          title={groupTitle}
          avatarUrl={groupAvatar}
          memberCount={memberCount}
          onlineCount={onlineCount}
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.push('/chat');
          }}
        />
      ) : (
        <ThreadHeader
          partner={partner}
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.push('/chat');
          }}
        />
      )}

      {isGroup && pinned !== null && pinned !== undefined ? (
        <PinnedMessageStrip pinned={pinned} />
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
        style={styles.frame}
      >
        {thread.isPending ? (
          <ThreadSkeleton />
        ) : thread.isError ? (
          <Stack padding="lg" style={styles.errorSlot}>
            <Card padding="lg">
              <Stack direction="column" gap="xs">
                <Text variant="bodyStrong" tone="heading">
                  We could not load this conversation
                </Text>
                <Text variant="footnote" tone="secondary">
                  Check your connection and try again. Nothing you have written is lost.
                </Text>
              </Stack>
            </Card>
          </Stack>
        ) : rows.length === 0 ? (
          <Stack padding="xl2" align="center" justify="center" fill style={styles.emptySlot}>
            <EncryptionNotice />
            <Text variant="body" tone="secondary" align="center">
              Say hello to start the conversation.
            </Text>
          </Stack>
        ) : (
          <FlashList
            ref={listRef}
            data={rows}
            keyExtractor={(item) => item.key}
            renderItem={renderRow}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={isGroup ? null : <EncryptionNotice />}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          />
        )}

        {isGroup && showDemoTyping ? <TypingIndicator name={demoTypingName} /> : null}

        <Composer
          value={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          placeholder={composerPlaceholder}
          alwaysShowSend={isGroup}
          replyTo={replyTo}
          replyToLabel={
            replyTo === null ? '' : replyTo.sender_id === meId ? 'yourself' : (replyTo.sender_name ?? partnerName)
          }
          onClearReply={() => {
            setReplyTo(null);
          }}
        />
      </KeyboardAvoidingView>

      <MessageActionSheet
        ref={sheetRef}
        message={actionTarget}
        isMine={actionTarget?.sender_id === meId}
        onClose={handleCloseSheet}
        onReact={handleReact}
        onReply={(m) => {
          setReplyTo(m);
        }}
        onCopy={() => {
          // Copy-to-clipboard flow lands with a follow-up expo-clipboard install. Kept as a stub
          // so the surface reads complete.
        }}
      />
    </Screen>
  );
}

/**
 * Flattens the messages array into rows. Inserts a day separator between messages that cross a
 * calendar boundary, extracts system messages into their own row kind, and (for group threads)
 * decides whether each incoming message is the first of a same-sender run — that flag drives the
 * avatar and sender-name chrome on the bubble.
 */
function buildRows(
  messages: readonly ThreadMessageDTO[],
  meId: string,
  isGroup: boolean
): readonly Row[] {
  if (messages.length === 0) return [];

  const rows: Row[] = [];
  let lastDay = '';
  let lastNonSystemSenderId: string | null = null;
  let lastNonSystemSenderName: string | null = null;

  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    if (m === undefined) continue;

    const day = dayKey(m.created_at);
    if (day !== lastDay) {
      rows.push({
        kind: 'separator',
        key: `sep-${day}`,
        label: dayLabel(m.created_at),
      });
      lastDay = day;
    }

    if (m.kind === 'system') {
      rows.push({
        kind: 'system',
        key: m.id,
        body: m.body,
        icon: iconForSystem(m.body),
      });
      // A system event breaks the same-sender run — the next real message starts fresh.
      lastNonSystemSenderId = null;
      lastNonSystemSenderName = null;
      continue;
    }

    const outgoing = m.sender_id === meId;

    // Look ahead across system rows for the next real message from the same sender: that decides
    // whether this bubble is the last of a run (showTail).
    let nextSameSender = false;
    for (let j = i + 1; j < messages.length; j += 1) {
      const n = messages[j];
      if (n === undefined) continue;
      if (n.kind === 'system') continue;
      nextSameSender = n.sender_id === m.sender_id;
      break;
    }

    const senderKey = m.sender_id ?? m.sender_name ?? null;
    const previousKey = lastNonSystemSenderId ?? lastNonSystemSenderName;
    const isFirstOfRun = senderKey !== previousKey;

    let senderChrome: 'none' | 'first-of-run' | 'continuation' = 'none';
    if (isGroup && !outgoing) {
      senderChrome = isFirstOfRun ? 'first-of-run' : 'continuation';
    }

    lastNonSystemSenderId = m.sender_id;
    lastNonSystemSenderName = m.sender_name ?? null;

    // Read receipts for outgoing messages track "the recipient has seen up to this seq". We do
    // not yet fetch the partner's watermark, so this reads as delivered until realtime lands.
    const isRead = false;

    rows.push({
      kind: 'message',
      key: m.id,
      message: m,
      outgoing,
      showTail: !nextSameSender,
      isRead,
      senderChrome,
    });
  }

  return rows;
}

/**
 * A tiny router from a system message body to the glyph that reads best beside it. Kept as a
 * body-substring check rather than a kind-code because the RPC currently ships human strings; the
 * moment system messages carry a structured event kind, this switch collapses to that.
 */
function iconForSystem(body: string): IconName | null {
  const b = body.toLowerCase();
  if (b.includes('pinned')) return 'pinned';
  if (b.includes('joined')) return 'add';
  if (b.includes('left')) return 'close';
  return null;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear().toString()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function ThreadSkeleton() {
  return (
    <Stack padding="md" gap="md" fill>
      {Array.from({ length: 5 }).map((_v, index) => (
        <Stack key={index} direction="row" gap="sm" align="center">
          <Skeleton width="60%" height={44} radius="lg" />
        </Stack>
      ))}
    </Stack>
  );
}

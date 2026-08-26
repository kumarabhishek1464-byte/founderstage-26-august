/**
 * The 1-to-1 conversation screen.
 *
 * ## Composition
 *
 * Header at the top (partner identity + actions), a flat message list in the middle, encryption
 * notice above the first message run, composer glued to the bottom. Everything data-shaped comes
 * from `useThread(id)`; sends go through `useSendMessage`; reactions through `useToggleReaction`.
 *
 * ## Newest-at-bottom, oldest-at-top
 *
 * The RPC returns messages sorted by `seq` ascending, so the array is already in reading order and
 * `FlashList` is not inverted — inverted lists on FlashList have persistent quirks around initial
 * scroll positioning. Instead the list scrolls to the last row after the first render and again
 * after each successful send, which is what a chat visually needs anyway.
 *
 * ## Date separators inserted as siblings
 *
 * A separator is not a message, so it does not belong in the messages array as another kind. The
 * flat data passed to the list is a tagged union of separators and message rows built once per
 * `data` change; the list renderer discriminates on the tag.
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
import { MessageActionSheet } from '@/features/messaging/components/MessageActionSheet';
import { MessageBubble } from '@/features/messaging/components/MessageBubble';
import { ThreadHeader } from '@/features/messaging/components/ThreadHeader';
import {
  useSendMessage,
  useThread,
  useToggleReaction,
} from '@/features/messaging/model/use-thread';

import type { SheetRef } from '@/core/design-system';
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
    };

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

  const partner = thread.data?.partner ?? null;
  const partnerName = partner?.name ?? 'this conversation';
  const meId = thread.data?.me_user_id ?? '';

  const rows = useMemo<readonly Row[]>(
    () => buildRows(thread.data?.messages ?? [], meId),
    [thread.data?.messages, meId]
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
      return (
        <Stack style={styles.messageWrap}>
          <MessageBubble
            message={item.message}
            outgoing={item.outgoing}
            showTail={item.showTail}
            isRead={item.isRead}
            partnerName={partnerName}
            onLongPress={handleLongPress}
            onToggleReaction={handleReact}
          />
        </Stack>
      );
    },
    [styles.messageWrap, partnerName, handleLongPress, handleReact]
  );

  return (
    <Screen padded={false} safeBottom={false}>
      <ThreadHeader
        partner={partner}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.push('/chat');
        }}
      />

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
            ListHeaderComponent={<EncryptionNotice />}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          />
        )}

        <Composer
          value={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          replyTo={replyTo}
          replyToLabel={
            replyTo === null ? '' : replyTo.sender_id === meId ? 'yourself' : partnerName
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
          // Copy-to-clipboard flow lands with a follow-up expo-clipboard install. Kept as a stub so
          // the surface reads complete.
        }}
      />
    </Screen>
  );
}

/**
 * Flattens the messages array into a list of rows, inserting a day separator between messages that
 * cross a calendar boundary. `showTail` is set on the last message of a same-sender run so the
 * bubble tucks its outward corner — the WhatsApp-style visual break between speakers.
 */
function buildRows(messages: readonly ThreadMessageDTO[], meId: string): readonly Row[] {
  if (messages.length === 0) return [];

  const rows: Row[] = [];
  let lastDay = '';

  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    if (m === undefined) continue;
    const next = messages[i + 1];
    const day = dayKey(m.created_at);
    if (day !== lastDay) {
      rows.push({
        kind: 'separator',
        key: `sep-${day}`,
        label: dayLabel(m.created_at),
      });
      lastDay = day;
    }
    const outgoing = m.sender_id === meId;
    const nextSameSender = next?.sender_id === m.sender_id;
    // Read receipts for outgoing messages are tracked as "the recipient has seen up to this seq".
    // We do not yet fetch the *partner's* read watermark, so this reads as "delivered" until the
    // realtime layer lands. The tick still shows.
    const isRead = false;
    rows.push({
      kind: 'message',
      key: m.id,
      message: m,
      outgoing,
      showTail: !nextSameSender,
      isRead,
    });
  }

  return rows;
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

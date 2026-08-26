-- Messaging thread: reactions, replies, attachments, plus the RPCs the 1-to-1 chat surface reads
-- and writes through. All mutations remain SECURITY DEFINER RPCs -- clients never write these
-- tables directly, which is what lets us change the "you can send while muted" rule in one place.

ALTER TABLE public.messaging_messages
  ADD COLUMN IF NOT EXISTS reply_to_seq bigint,
  ADD COLUMN IF NOT EXISTS attachment jsonb;

CREATE TABLE IF NOT EXISTS public.messaging_reactions (
  message_id uuid NOT NULL REFERENCES public.messaging_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  reacted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS messaging_reactions_msg_idx ON public.messaging_reactions(message_id);

ALTER TABLE public.messaging_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_reactions_of_my_convs" ON public.messaging_reactions;
CREATE POLICY "select_reactions_of_my_convs"
  ON public.messaging_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messaging_messages m
      WHERE m.id = messaging_reactions.message_id
        AND public.messaging_is_member(m.conversation_id, (select auth.uid()))
    )
  );

-- ─── send_message ─────────────────────────────────────────────────────────────────────────────
-- Atomic seq allocation via `UPDATE ... RETURNING` on the conversation row. Two concurrent sends
-- cannot land on the same seq because the row is locked between the read and the return.
CREATE OR REPLACE FUNCTION public.messaging_send_message(
  cid uuid,
  body_in text,
  reply_to_seq_in bigint DEFAULT NULL,
  attachment_in jsonb DEFAULT NULL,
  kind_in text DEFAULT 'text'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := (select auth.uid());
  next_seq bigint;
  new_id uuid;
  now_ts timestamptz := now();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF NOT public.messaging_is_member(cid, uid) THEN RAISE EXCEPTION 'not a member' USING ERRCODE = '42501'; END IF;
  IF kind_in NOT IN ('text','attachment','voice') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  IF kind_in = 'text' THEN
    IF body_in IS NULL OR length(trim(body_in)) = 0 THEN RAISE EXCEPTION 'empty message'; END IF;
    IF length(body_in) > 10000 THEN RAISE EXCEPTION 'message too long'; END IF;
  END IF;

  UPDATE public.messaging_conversations
     SET last_seq = last_seq + 1, last_message_at = now_ts
   WHERE id = cid
   RETURNING last_seq INTO next_seq;

  INSERT INTO public.messaging_messages
    (conversation_id, seq, sender_id, kind, body, created_at, reply_to_seq, attachment)
  VALUES (cid, next_seq, uid, kind_in, COALESCE(body_in, ''), now_ts, reply_to_seq_in, attachment_in)
  RETURNING id INTO new_id;

  -- Sender does not need to "read" their own message.
  UPDATE public.messaging_conversation_members
     SET last_read_seq = GREATEST(last_read_seq, next_seq)
   WHERE conversation_id = cid AND user_id = uid;

  RETURN jsonb_build_object(
    'id', new_id,
    'seq', next_seq,
    'sender_id', uid,
    'kind', kind_in,
    'body', COALESCE(body_in, ''),
    'created_at', now_ts,
    'reply_to_seq', reply_to_seq_in,
    'attachment', attachment_in
  );
END;
$$;

REVOKE ALL ON FUNCTION public.messaging_send_message(uuid, text, bigint, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.messaging_send_message(uuid, text, bigint, jsonb, text) TO authenticated;

-- ─── toggle_reaction ──────────────────────────────────────────────────────────────────────────
-- Idempotent: same (user, message, emoji) toggles off; otherwise on.
CREATE OR REPLACE FUNCTION public.messaging_toggle_reaction(msg_id uuid, emoji_in text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := (select auth.uid());
  cid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF emoji_in IS NULL OR length(emoji_in) = 0 OR length(emoji_in) > 16 THEN
    RAISE EXCEPTION 'invalid emoji';
  END IF;

  SELECT conversation_id INTO cid FROM public.messaging_messages WHERE id = msg_id;
  IF cid IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT public.messaging_is_member(cid, uid) THEN RAISE EXCEPTION 'not a member' USING ERRCODE = '42501'; END IF;

  DELETE FROM public.messaging_reactions
   WHERE message_id = msg_id AND user_id = uid AND emoji = emoji_in;

  IF NOT FOUND THEN
    INSERT INTO public.messaging_reactions (message_id, user_id, emoji)
    VALUES (msg_id, uid, emoji_in);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.messaging_toggle_reaction(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.messaging_toggle_reaction(uuid, text) TO authenticated;

-- ─── thread_page ──────────────────────────────────────────────────────────────────────────────
-- Returns the newest `limit_in` messages older than `before_seq` (NULL → the newest page), plus
-- partner info, my read watermark, and whether there is more to fetch. Also auto-bumps the
-- caller's read watermark when they load the newest page (before_seq IS NULL).
CREATE OR REPLACE FUNCTION public.messaging_thread_page(
  cid uuid,
  before_seq bigint DEFAULT NULL,
  limit_in int DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := (select auth.uid());
  page_ids uuid[];
  page_min_seq bigint;
  has_more_flag boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF NOT public.messaging_is_member(cid, uid) THEN RAISE EXCEPTION 'not a member' USING ERRCODE = '42501'; END IF;

  SELECT array_agg(id), min(seq)
    INTO page_ids, page_min_seq
    FROM (
      SELECT id, seq FROM public.messaging_messages
       WHERE conversation_id = cid
         AND (before_seq IS NULL OR seq < before_seq)
       ORDER BY seq DESC
       LIMIT LEAST(limit_in, 200)
    ) t;

  has_more_flag := page_min_seq IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.messaging_messages
     WHERE conversation_id = cid AND seq < page_min_seq
  );

  IF before_seq IS NULL THEN
    UPDATE public.messaging_conversation_members
       SET last_read_seq = GREATEST(last_read_seq, (
         SELECT last_seq FROM public.messaging_conversations WHERE id = cid
       ))
     WHERE conversation_id = cid AND user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'me_user_id', uid,
    'partner', (
      SELECT jsonb_build_object(
        'user_id', p.id,
        'name', p.name,
        'avatar_url', NULL,
        'presence', 'online'
      )
      FROM public.messaging_conversation_members cm
      JOIN public.profiles p ON p.id = cm.user_id
      WHERE cm.conversation_id = cid
        AND cm.user_id <> uid
        AND cm.state = 'active'
      ORDER BY cm.joined_at ASC
      LIMIT 1
    ),
    'conversation', (
      SELECT jsonb_build_object(
        'id', c.id, 'type', c.type, 'title', c.title, 'last_seq', c.last_seq
      )
      FROM public.messaging_conversations c WHERE c.id = cid
    ),
    'last_read_seq', (
      SELECT last_read_seq FROM public.messaging_conversation_members
       WHERE conversation_id = cid AND user_id = uid
    ),
    'has_more', has_more_flag,
    'messages', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'seq', m.seq,
          'sender_id', m.sender_id,
          'kind', m.kind,
          'body', m.body,
          'created_at', m.created_at,
          'edited_at', m.edited_at,
          'deleted', m.deleted,
          'reply_to_seq', m.reply_to_seq,
          'attachment', m.attachment,
          'reply_to', (
            SELECT jsonb_build_object(
              'seq', rm.seq, 'sender_id', rm.sender_id, 'body', rm.body, 'deleted', rm.deleted
            )
            FROM public.messaging_messages rm
            WHERE rm.conversation_id = cid AND rm.seq = m.reply_to_seq
          ),
          'reactions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'emoji', e.emoji, 'count', e.n, 'mine', e.mine
            ) ORDER BY e.n DESC, e.emoji ASC)
            FROM (
              SELECT r.emoji, count(*)::int AS n, bool_or(r.user_id = uid) AS mine
              FROM public.messaging_reactions r
              WHERE r.message_id = m.id
              GROUP BY r.emoji
            ) e
          ), '[]'::jsonb)
        ) ORDER BY m.seq ASC
      )
      FROM public.messaging_messages m
      WHERE m.id = ANY(page_ids)
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.messaging_thread_page(uuid, bigint, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.messaging_thread_page(uuid, bigint, int) TO authenticated;

-- ─── Refresh the seeder ───────────────────────────────────────────────────────────────────────
-- Replaces the Kavya conversation with the Rohit Sharma thread from the design reference. Every
-- other conversation is unchanged. Still guarded so it is a one-shot per caller.
CREATE OR REPLACE FUNCTION public.messaging_seed_demo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := (select auth.uid());
  c_rohit uuid; c_group uuid; c_isha uuid; c_ganesh uuid; c_pt uuid; c_neha uuid; c_yc uuid;
  m_agenda uuid; m_pdf uuid; m_bye uuid;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.messaging_conversation_members WHERE user_id = uid) THEN RETURN; END IF;

  INSERT INTO public.messaging_conversations (type, title, created_by, last_message_at, last_seq)
    VALUES ('direct', 'Rohit Sharma', uid, now() - interval '1 hour' - interval '24 minutes', 9)
    RETURNING id INTO c_rohit;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, is_pinned, last_read_seq)
    VALUES (c_rohit, uid, true, 9);

  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, kind, body, created_at) VALUES
    (c_rohit, 1, NULL, 'text', 'Hey Abhi! 👋', now() - interval '1 hour' - interval '30 minutes'),
    (c_rohit, 2, NULL, 'text', 'Are we still on for the call today at 4 PM?', now() - interval '1 hour' - interval '30 minutes'),
    (c_rohit, 3, uid,  'text', 'Hey Rohit! Yes, absolutely. 4 PM works perfectly.', now() - interval '1 hour' - interval '28 minutes');

  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, kind, body, created_at)
    VALUES (c_rohit, 4, NULL, 'text', 'Great! I''ll share the agenda before the call.', now() - interval '1 hour' - interval '27 minutes')
    RETURNING id INTO m_agenda;

  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, kind, body, created_at) VALUES
    (c_rohit, 5, uid, 'text', 'Thanks! Also, can you share the pitch deck you mentioned?', now() - interval '1 hour' - interval '26 minutes');

  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, kind, body, attachment, created_at)
    VALUES (c_rohit, 6, NULL, 'attachment', 'FounderStage_Pitch_Deck.pdf',
      jsonb_build_object('name','FounderStage_Pitch_Deck.pdf','size',2516582,'mime','application/pdf'),
      now() - interval '1 hour' - interval '25 minutes')
    RETURNING id INTO m_pdf;

  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, kind, body, created_at) VALUES
    (c_rohit, 7, NULL, 'text', 'Here you go!', now() - interval '1 hour' - interval '25 minutes'),
    (c_rohit, 8, uid,  'text', 'This looks great 🔥 Let''s discuss in detail on the call.', now() - interval '1 hour' - interval '24 minutes');

  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, kind, body, created_at)
    VALUES (c_rohit, 9, NULL, 'text', 'Sounds good. Talk to you then!', now() - interval '1 hour' - interval '24 minutes')
    RETURNING id INTO m_bye;

  INSERT INTO public.messaging_reactions (message_id, user_id, emoji) VALUES
    (m_agenda, uid, '👍'),
    (m_pdf,    uid, '🔥'),
    (m_bye,    uid, '❤️');

  INSERT INTO public.messaging_conversations (type, title, description, created_by, last_message_at, last_seq)
    VALUES ('group', 'Founders in Bangalore', 'Weekly ops sync', uid, now() - interval '2 hours', 128)
    RETURNING id INTO c_group;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, role, is_pinned, is_muted, last_read_seq)
    VALUES (c_group, uid, 'admin', true, true, 116);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at)
    VALUES (c_group, 128, NULL, 'Anyone hiring a growth intern in July?', now() - interval '2 hours');

  INSERT INTO public.messaging_conversations (type, title, created_by, last_message_at, last_seq)
    VALUES ('direct', 'Ganesh Patel', uid, now() - interval '3 hours', 12)
    RETURNING id INTO c_ganesh;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, last_read_seq)
    VALUES (c_ganesh, uid, 10);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at) VALUES
    (c_ganesh, 11, NULL, 'Can we jump on a call this week?', now() - interval '4 hours'),
    (c_ganesh, 12, NULL, 'Thu 4pm works — sending an invite.', now() - interval '3 hours');

  INSERT INTO public.messaging_conversations (type, title, description, created_by, last_message_at, last_seq)
    VALUES ('group', 'Product Hunt launch prep', 'Ship-week war room', uid, now() - interval '5 hours', 42)
    RETURNING id INTO c_pt;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, role, last_read_seq)
    VALUES (c_pt, uid, 'owner', 42);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at)
    VALUES (c_pt, 42, NULL, 'All hero assets are in the Drive folder.', now() - interval '5 hours');

  INSERT INTO public.messaging_conversations (type, title, created_by, last_message_at, last_seq)
    VALUES ('direct', 'Isha Rao', uid, now() - interval '1 day', 5)
    RETURNING id INTO c_isha;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, last_read_seq)
    VALUES (c_isha, uid, 5);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at)
    VALUES (c_isha, 5, NULL, 'Sending intros over the weekend.', now() - interval '1 day');

  INSERT INTO public.messaging_conversations (type, title, created_by, last_message_at, last_seq)
    VALUES ('direct', 'Neha Sharma', uid, now() - interval '2 days', 7)
    RETURNING id INTO c_neha;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, last_read_seq)
    VALUES (c_neha, uid, 6);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at)
    VALUES (c_neha, 7, NULL, 'Shared the shortlist of designers — take a look.', now() - interval '2 days');

  INSERT INTO public.messaging_conversations (type, title, description, created_by, last_message_at, last_seq)
    VALUES ('group', 'YC S26 India cohort', 'Alumni-only channel', uid, now() - interval '3 days', 512)
    RETURNING id INTO c_yc;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, role, last_read_seq)
    VALUES (c_yc, uid, 'member', 512);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at)
    VALUES (c_yc, 512, NULL, 'Demo Day slots opening tomorrow — reply here.', now() - interval '3 days');
END;
$$;
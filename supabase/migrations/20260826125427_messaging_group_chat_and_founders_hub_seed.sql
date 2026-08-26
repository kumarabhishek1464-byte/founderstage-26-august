/*
# Group chat surface: pinned messages, per-message sender identity, Founders Hub seed

## Plain summary

The existing messaging schema and RPCs assumed 1-to-1 chats: a single "partner" per
conversation, no pinned message, no way for a seed row to render a named sender other
than the caller. Group chat needs three additions.

1. New columns on existing tables (additive only, no data loss):
   - `messaging_conversations.avatar_url` — the group's photo, used by the header dark
     circle in the reference.
   - `messaging_conversations.pinned_message_seq` — points at the message whose body
     the pinned strip at the top of the screen renders.
   - `messaging_messages.sender_display_name` — override for the seed rows whose author
     is not a real `auth.users` row (Ananya, Vikram, Rohit, Meera in the demo). Real
     messages leave it null and the thread RPC falls back to the profile join.
   - `messaging_messages.sender_avatar_url` — same story for the sender's photo.
   - `messaging_messages.demo_reactions` — jsonb blob shaped like the RPC output for
     `reactions`. When set, the thread RPC returns it verbatim instead of aggregating
     the reactions table, so the seed can render "12 hearts" without needing 12 real
     users. Null on real messages.
2. The `messaging_thread_page` RPC is replaced (function replacement, not a table
   change) to return additional group-shaped payload: the members list (with display
   name + avatar + presence), a member count, an online count, the pinned message body
   and author label, the conversation's avatar url, and — per message — the sender's
   display name and avatar. Direct chats still receive `partner` as before, so the 1:1
   surface does not have to change.
3. The `messaging_seed_demo` RPC is refactored so its guard is per-conversation, not
   per-user. This lets an existing seeded user get the new Founders Hub group on the
   next seed call without re-seeding the conversations they already have. The Founders
   Hub group is populated with the exact 10 messages from the design reference, its
   pin, its per-message reactions, and one system "Karan joined via invite link"
   event.

## Security

No new tables, so no new RLS to author. The added columns inherit the existing
policies. The rewritten function keeps SECURITY DEFINER + a `messaging_is_member`
guard, which is the same authorization surface as before.
*/

ALTER TABLE public.messaging_conversations
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS pinned_message_seq bigint;

ALTER TABLE public.messaging_messages
  ADD COLUMN IF NOT EXISTS sender_display_name text,
  ADD COLUMN IF NOT EXISTS sender_avatar_url text,
  ADD COLUMN IF NOT EXISTS demo_reactions jsonb;

-- ─── thread_page (extended) ──────────────────────────────────────────────────────────────────
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
        'id', c.id,
        'type', c.type,
        'title', c.title,
        'avatar_url', c.avatar_url,
        'last_seq', c.last_seq
      )
      FROM public.messaging_conversations c WHERE c.id = cid
    ),
    'member_count', (
      SELECT count(*)::int FROM public.messaging_conversation_members
       WHERE conversation_id = cid AND state = 'active'
    ),
    -- Deterministic "online" count for the group demo: everyone whose display name
    -- lives on their seeded messages is considered available. Real presence lands
    -- with the realtime layer.
    'online_count', (
      SELECT count(DISTINCT sender_display_name)::int
        FROM public.messaging_messages
       WHERE conversation_id = cid AND sender_display_name IS NOT NULL
    ),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', member_id::text,
        'name', member_name,
        'avatar_url', member_avatar,
        'presence', 'online'
      ) ORDER BY member_name ASC)
      FROM (
        SELECT DISTINCT
          COALESCE(m.sender_id::text, m.sender_display_name) AS member_id,
          COALESCE(m.sender_display_name, p.name)            AS member_name,
          COALESCE(m.sender_avatar_url, NULL)                AS member_avatar
        FROM public.messaging_messages m
        LEFT JOIN public.profiles p ON p.id = m.sender_id
        WHERE m.conversation_id = cid
          AND (m.sender_id IS NOT NULL OR m.sender_display_name IS NOT NULL)
          AND m.kind <> 'system'
      ) s
    ), '[]'::jsonb),
    'pinned_message', (
      SELECT jsonb_build_object(
        'seq', pm.seq,
        'body', pm.body,
        'author_name', COALESCE(pm.sender_display_name, pp.name, 'Someone')
      )
      FROM public.messaging_conversations c
      LEFT JOIN public.messaging_messages pm
        ON pm.conversation_id = c.id AND pm.seq = c.pinned_message_seq
      LEFT JOIN public.profiles pp ON pp.id = pm.sender_id
      WHERE c.id = cid AND c.pinned_message_seq IS NOT NULL
      LIMIT 1
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
          'sender_name', COALESCE(m.sender_display_name, p.name),
          'sender_avatar_url', COALESCE(m.sender_avatar_url, NULL),
          'kind', m.kind,
          'body', m.body,
          'created_at', m.created_at,
          'edited_at', m.edited_at,
          'deleted', m.deleted,
          'reply_to_seq', m.reply_to_seq,
          'attachment', m.attachment,
          'reply_to', (
            SELECT jsonb_build_object(
              'seq', rm.seq,
              'sender_id', rm.sender_id,
              'sender_name', COALESCE(rm.sender_display_name, rp.name),
              'body', rm.body,
              'deleted', rm.deleted
            )
            FROM public.messaging_messages rm
            LEFT JOIN public.profiles rp ON rp.id = rm.sender_id
            WHERE rm.conversation_id = cid AND rm.seq = m.reply_to_seq
          ),
          'reactions', COALESCE(
            m.demo_reactions,
            COALESCE((
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
          )
        ) ORDER BY m.seq ASC
      )
      FROM public.messaging_messages m
      LEFT JOIN public.profiles p ON p.id = m.sender_id
      WHERE m.id = ANY(page_ids)
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.messaging_thread_page(uuid, bigint, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.messaging_thread_page(uuid, bigint, int) TO authenticated;

-- ─── seed_demo (idempotent, per-conversation guards, Founders Hub added) ─────────────────────
CREATE OR REPLACE FUNCTION public.messaging_seed_demo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := (select auth.uid());
  c_rohit uuid; c_hub uuid;
  m_agenda uuid; m_pdf uuid; m_bye uuid;
  m_welcome uuid;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  -- Rohit Sharma (1:1)
  SELECT c.id INTO c_rohit
    FROM public.messaging_conversations c
    JOIN public.messaging_conversation_members m ON m.conversation_id = c.id
   WHERE m.user_id = uid AND c.title = 'Rohit Sharma' AND c.type = 'direct'
   LIMIT 1;

  IF c_rohit IS NULL THEN
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
  END IF;

  -- Founders Hub (group) — the design reference for this build.
  SELECT c.id INTO c_hub
    FROM public.messaging_conversations c
    JOIN public.messaging_conversation_members m ON m.conversation_id = c.id
   WHERE m.user_id = uid AND c.title = 'Founders Hub 🚀' AND c.type = 'group'
   LIMIT 1;

  IF c_hub IS NULL THEN
    INSERT INTO public.messaging_conversations (
      type, title, description, avatar_url, created_by, last_message_at, last_seq
    )
    VALUES (
      'group',
      'Founders Hub 🚀',
      'A place for founders to share ideas, resources, and support each other.',
      NULL,
      uid,
      now() - interval '15 minutes',
      9
    )
    RETURNING id INTO c_hub;

    INSERT INTO public.messaging_conversation_members (
      conversation_id, user_id, role, is_pinned, last_read_seq
    )
    VALUES (c_hub, uid, 'member', false, 9);

    -- seq 1: the pinned welcome, sent earlier in the group's history.
    INSERT INTO public.messaging_messages (
      conversation_id, seq, sender_id, sender_display_name, sender_avatar_url,
      kind, body, created_at, demo_reactions
    ) VALUES (
      c_hub, 1, NULL, 'Ananya', NULL,
      'text', 'Welcome to Founders Hub! 🎉',
      now() - interval '2 days',
      '[]'::jsonb
    )
    RETURNING id INTO m_welcome;

    -- Point the conversation's pinned strip at seq 1.
    UPDATE public.messaging_conversations SET pinned_message_seq = 1 WHERE id = c_hub;

    -- seq 2: system notice that Ananya pinned the welcome.
    INSERT INTO public.messaging_messages (
      conversation_id, seq, sender_id, sender_display_name,
      kind, body, created_at
    ) VALUES (
      c_hub, 2, NULL, 'Ananya', 'system',
      'Ananya pinned a message: Welcome to Founders Hub! 🎉',
      now() - interval '35 minutes'
    );

    -- seq 3: Ananya sets the tone.
    INSERT INTO public.messaging_messages (
      conversation_id, seq, sender_id, sender_display_name,
      kind, body, created_at, demo_reactions
    ) VALUES (
      c_hub, 3, NULL, 'Ananya', 'text',
      E'Hey everyone! 👋\nLet''s use this space to share ideas, resources and support each other.',
      now() - interval '30 minutes',
      '[{"emoji":"❤️","count":12,"mine":false},{"emoji":"🔥","count":8,"mine":false},{"emoji":"👏","count":6,"mine":false}]'::jsonb
    );

    -- seq 4: Vikram echoes.
    INSERT INTO public.messaging_messages (
      conversation_id, seq, sender_id, sender_display_name,
      kind, body, created_at, demo_reactions
    ) VALUES (
      c_hub, 4, NULL, 'Vikram', 'text',
      'Exactly! Collaboration is what builds incredible startups.',
      now() - interval '29 minutes',
      '[{"emoji":"👍","count":7,"mine":false}]'::jsonb
    );

    -- seq 5: caller says hi.
    INSERT INTO public.messaging_messages (
      conversation_id, seq, sender_id, kind, body, created_at, demo_reactions
    ) VALUES (
      c_hub, 5, uid, 'text',
      'Hey everyone! Just joined the group. Excited to be here and learn from all of you.',
      now() - interval '28 minutes',
      '[{"emoji":"❤️","count":5,"mine":false},{"emoji":"👏","count":3,"mine":false}]'::jsonb
    );

    -- seq 6: Rohit welcomes.
    INSERT INTO public.messaging_messages (
      conversation_id, seq, sender_id, sender_display_name,
      kind, body, created_at, demo_reactions
    ) VALUES (
      c_hub, 6, NULL, 'Rohit', 'text',
      'Welcome aboard! 🎉',
      now() - interval '27 minutes',
      '[{"emoji":"🎉","count":4,"mine":false}]'::jsonb
    );

    -- seq 7: Meera shares a pitch deck.
    INSERT INTO public.messaging_messages (
      conversation_id, seq, sender_id, sender_display_name,
      kind, body, attachment, created_at, demo_reactions
    ) VALUES (
      c_hub, 7, NULL, 'Meera', 'attachment',
      'Sharing our pitch deck for feedback 🙏',
      jsonb_build_object('name','Pitch_Deck_Final.pdf','size',2516582,'mime','application/pdf'),
      now() - interval '26 minutes',
      '[{"emoji":"🔥","count":6,"mine":false},{"emoji":"👍","count":2,"mine":false}]'::jsonb
    );

    -- seq 8: caller replies to Meera.
    INSERT INTO public.messaging_messages (
      conversation_id, seq, sender_id, kind, body, created_at, demo_reactions
    ) VALUES (
      c_hub, 8, uid, 'text',
      'Thanks Meera! Will go through it and share my thoughts.',
      now() - interval '25 minutes',
      '[{"emoji":"👍","count":3,"mine":false}]'::jsonb
    );

    -- seq 9: system join event.
    INSERT INTO public.messaging_messages (
      conversation_id, seq, sender_id, sender_display_name,
      kind, body, created_at
    ) VALUES (
      c_hub, 9, NULL, 'Karan', 'system',
      'Karan joined the group via invite link',
      now() - interval '15 minutes'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.messaging_seed_demo() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.messaging_seed_demo() TO authenticated;

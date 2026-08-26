-- Messaging schema — conversations, memberships, messages — with RLS + inbox RPC.

CREATE TABLE IF NOT EXISTS public.messaging_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct','group')),
  title text,
  avatar_url text,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  last_seq bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.messaging_conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.messaging_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','moderator','admin','owner')),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','left','removed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  last_read_seq bigint NOT NULL DEFAULT 0,
  notification_level text NOT NULL DEFAULT 'all' CHECK (notification_level IN ('all','mentions','none')),
  is_pinned boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS messaging_conv_members_user_idx
  ON public.messaging_conversation_members (user_id)
  WHERE state = 'active';

CREATE TABLE IF NOT EXISTS public.messaging_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.messaging_conversations(id) ON DELETE CASCADE,
  seq bigint NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','attachment','voice','system')),
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted boolean NOT NULL DEFAULT false,
  UNIQUE (conversation_id, seq)
);

CREATE INDEX IF NOT EXISTS messaging_messages_conv_seq_idx
  ON public.messaging_messages (conversation_id, seq DESC);

CREATE OR REPLACE FUNCTION public.messaging_is_member(cid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messaging_conversation_members
    WHERE conversation_id = cid AND user_id = uid AND state = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.messaging_is_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.messaging_is_member(uuid, uuid) TO authenticated;

ALTER TABLE public.messaging_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_convs_i_belong_to" ON public.messaging_conversations;
CREATE POLICY "select_convs_i_belong_to"
  ON public.messaging_conversations FOR SELECT
  TO authenticated
  USING (public.messaging_is_member(id, (select auth.uid())));

DROP POLICY IF EXISTS "select_own_membership" ON public.messaging_conversation_members;
CREATE POLICY "select_own_membership"
  ON public.messaging_conversation_members FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "select_messages_of_my_convs" ON public.messaging_messages;
CREATE POLICY "select_messages_of_my_convs"
  ON public.messaging_messages FOR SELECT
  TO authenticated
  USING (public.messaging_is_member(conversation_id, (select auth.uid())));

CREATE OR REPLACE FUNCTION public.messaging_inbox_list()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(x)
      ORDER BY x.is_pinned DESC, x.last_message_at DESC NULLS LAST
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT
      c.id,
      c.type,
      c.title,
      c.avatar_url,
      c.description,
      c.last_message_at,
      c.last_seq,
      m.is_pinned,
      m.is_muted,
      m.is_archived,
      m.last_read_seq,
      m.role,
      m.notification_level,
      GREATEST(c.last_seq - m.last_read_seq, 0)::int AS unread_count,
      (
        SELECT jsonb_build_object(
          'body', mm.body,
          'kind', mm.kind,
          'sender_id', mm.sender_id,
          'created_at', mm.created_at,
          'deleted', mm.deleted
        )
        FROM public.messaging_messages mm
        WHERE mm.conversation_id = c.id
        ORDER BY mm.seq DESC
        LIMIT 1
      ) AS last_message,
      COALESCE(
        (
          SELECT jsonb_agg(jsonb_build_object(
            'user_id', p.id,
            'name', p.name,
            'avatar_url', NULL
          ))
          FROM public.messaging_conversation_members m2
          JOIN public.profiles p ON p.id = m2.user_id
          WHERE m2.conversation_id = c.id
            AND m2.user_id <> (select auth.uid())
            AND m2.state = 'active'
        ),
        '[]'::jsonb
      ) AS partners,
      (
        SELECT count(*)::int FROM public.messaging_conversation_members
        WHERE conversation_id = c.id AND state = 'active'
      ) AS member_count
    FROM public.messaging_conversations c
    JOIN public.messaging_conversation_members m
      ON m.conversation_id = c.id
     AND m.user_id = (select auth.uid())
     AND m.state = 'active'
    WHERE m.is_archived = false
  ) x;
$$;

REVOKE ALL ON FUNCTION public.messaging_inbox_list() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.messaging_inbox_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.messaging_seed_demo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := (select auth.uid());
  c_kavya uuid; c_group uuid; c_isha uuid; c_ganesh uuid; c_pt uuid; c_neha uuid; c_yc uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.messaging_conversation_members WHERE user_id = uid) THEN
    RETURN;
  END IF;

  INSERT INTO public.messaging_conversations (type, title, created_by, last_message_at, last_seq)
    VALUES ('direct', 'Kavya Iyer', uid, now() - interval '9 minutes', 3)
    RETURNING id INTO c_kavya;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, is_pinned, last_read_seq)
    VALUES (c_kavya, uid, true, 2);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at) VALUES
    (c_kavya, 1, uid, 'Hey — did you get a chance to look at the deck?', now() - interval '25 minutes'),
    (c_kavya, 2, NULL, 'Yes! The traction slide reads really well.', now() - interval '15 minutes'),
    (c_kavya, 3, NULL, 'Big congrats on the seed round.', now() - interval '9 minutes');

  INSERT INTO public.messaging_conversations (type, title, description, created_by, last_message_at, last_seq)
    VALUES ('group', 'Founders in Bangalore', 'Weekly ops sync', uid, now() - interval '2 hours', 128)
    RETURNING id INTO c_group;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, role, is_pinned, is_muted, last_read_seq)
    VALUES (c_group, uid, 'admin', true, true, 116);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at) VALUES
    (c_group, 128, NULL, 'Anyone hiring a growth intern in July?', now() - interval '2 hours');

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
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at) VALUES
    (c_pt, 42, NULL, 'All hero assets are in the Drive folder.', now() - interval '5 hours');

  INSERT INTO public.messaging_conversations (type, title, created_by, last_message_at, last_seq)
    VALUES ('direct', 'Isha Rao', uid, now() - interval '1 day', 5)
    RETURNING id INTO c_isha;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, last_read_seq)
    VALUES (c_isha, uid, 5);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at) VALUES
    (c_isha, 5, NULL, 'Sending intros over the weekend.', now() - interval '1 day');

  INSERT INTO public.messaging_conversations (type, title, created_by, last_message_at, last_seq)
    VALUES ('direct', 'Neha Sharma', uid, now() - interval '2 days', 7)
    RETURNING id INTO c_neha;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, last_read_seq)
    VALUES (c_neha, uid, 6);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at) VALUES
    (c_neha, 7, NULL, 'Shared the shortlist of designers — take a look.', now() - interval '2 days');

  INSERT INTO public.messaging_conversations (type, title, description, created_by, last_message_at, last_seq)
    VALUES ('group', 'YC S26 India cohort', 'Alumni-only channel', uid, now() - interval '3 days', 512)
    RETURNING id INTO c_yc;
  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, role, last_read_seq)
    VALUES (c_yc, uid, 'member', 512);
  INSERT INTO public.messaging_messages (conversation_id, seq, sender_id, body, created_at) VALUES
    (c_yc, 512, NULL, 'Demo Day slots opening tomorrow — reply here.', now() - interval '3 days');
END;
$$;

REVOKE ALL ON FUNCTION public.messaging_seed_demo() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.messaging_seed_demo() TO authenticated;

CREATE OR REPLACE FUNCTION public.messaging_mark_read(cid uuid, up_to_seq bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.messaging_conversation_members
     SET last_read_seq = GREATEST(last_read_seq, up_to_seq)
   WHERE conversation_id = cid
     AND user_id = (select auth.uid());
$$;

REVOKE ALL ON FUNCTION public.messaging_mark_read(uuid, bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.messaging_mark_read(uuid, bigint) TO authenticated;
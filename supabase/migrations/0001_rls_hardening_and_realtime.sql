-- Everything in this file is hand-written: drizzle-kit does not generate any of it.

-- ---------------------------------------------------------------------------
-- 1. Table owners bypass RLS by default, and on Supabase `postgres` owns your
--    tables. The unit of work switches to `authenticated` with SET LOCAL ROLE,
--    but if that ever fails or is skipped the policies would silently not
--    apply. FORCE makes them apply to the owner too.
-- ---------------------------------------------------------------------------
ALTER TABLE public.todos FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Realtime via Broadcast from Database. Supabase recommends this over
--    Postgres Changes because it scales better and lets us choose the topic,
--    which is what makes per-user isolation possible below.
--
--    SECURITY DEFINER is required: the `realtime` schema is locked down and an
--    `authenticated` caller cannot invoke realtime.broadcast_changes directly.
--    Hence the pinned empty search_path and fully qualified names.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.broadcast_todo_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'todos:' || COALESCE(NEW.user_id, OLD.user_id)::text,  -- topic, scoped per user
    TG_OP,                                                 -- event
    TG_OP,                                                 -- operation
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS todos_broadcast ON public.todos;
--> statement-breakpoint

CREATE TRIGGER todos_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.todos
FOR EACH ROW EXECUTE FUNCTION public.broadcast_todo_changes();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Realtime Authorization.
--
--    CRITICAL: the official Supabase example uses `USING (true)`, which lets
--    any authenticated user subscribe to any topic. For per-user data that is
--    a straight read of somebody else's rows over the WebSocket. The topic
--    must be pinned to the caller's own uid.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users receive only own todo broadcasts" ON realtime.messages;
--> statement-breakpoint

CREATE POLICY "users receive only own todo broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND realtime.topic() = 'todos:' || (SELECT auth.uid())::text
);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Defense in depth on function privileges.
--
--    This project exposes no RPC, but CREATE FUNCTION grants EXECUTE to PUBLIC
--    automatically and Supabase adds per-schema grants for anon/authenticated
--    on top. A future function would be born callable by anonymous users.
--
--    Note the two different forms: the built-in PUBLIC grant is global, so a
--    per-schema REVOKE has no effect on it (a per-schema REVOKE can only undo
--    a matching per-schema GRANT). The Supabase grants for anon/authenticated
--    are per-schema, so those need the scoped form.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

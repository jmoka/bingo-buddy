-- 0111_fix_match_comments_rls_live_chat.sql
-- Corrige 403 no chat da live ao permitir leitura/escrita para usuarios autenticados
-- no mesmo tenant em partidas ativas (open/in_progress).

ALTER TABLE public.match_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all match comments" ON public.match_comments;
DROP POLICY IF EXISTS "Participants can view match comments" ON public.match_comments;
DROP POLICY IF EXISTS "Participants can insert match comments" ON public.match_comments;
DROP POLICY IF EXISTS "Authenticated users can view active match comments" ON public.match_comments;
DROP POLICY IF EXISTS "Authenticated users can insert active match comments" ON public.match_comments;
DROP POLICY IF EXISTS "Admins can moderate match comments" ON public.match_comments;

CREATE POLICY "Authenticated users can view active match comments"
ON public.match_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.partidas p
    WHERE p.id = public.match_comments.match_id
      AND p.status IN ('open', 'in_progress')
      AND (
        (public.is_admin() AND p.admin_id = auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.perfis pf
          WHERE pf.id = auth.uid()
            AND pf.admins_id = p.admin_id
        )
        OR p.admin_id IS NULL
      )
  )
);

CREATE POLICY "Authenticated users can insert active match comments"
ON public.match_comments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1
    FROM public.partidas p
    WHERE p.id = public.match_comments.match_id
      AND p.status IN ('open', 'in_progress')
      AND (
        (public.is_admin() AND p.admin_id = auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.perfis pf
          WHERE pf.id = auth.uid()
            AND pf.admins_id = p.admin_id
        )
        OR p.admin_id IS NULL
      )
  )
);

CREATE POLICY "Admins can moderate match comments"
ON public.match_comments
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  AND EXISTS (
    SELECT 1
    FROM public.partidas p
    WHERE p.id = public.match_comments.match_id
      AND (p.admin_id = auth.uid() OR p.admin_id IS NULL)
  )
)
WITH CHECK (
  public.is_admin()
  AND EXISTS (
    SELECT 1
    FROM public.partidas p
    WHERE p.id = public.match_comments.match_id
      AND (p.admin_id = auth.uid() OR p.admin_id IS NULL)
  )
);

ALTER TABLE public.match_comments REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.match_comments;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

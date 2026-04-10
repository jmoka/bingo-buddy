-- Permite que cada admin atualize o proprio perfil na tabela public.admins
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem atualizar proprio perfil" ON public.admins;
CREATE POLICY "Admins podem atualizar proprio perfil"
ON public.admins
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

NOTIFY pgrst, 'reload schema';

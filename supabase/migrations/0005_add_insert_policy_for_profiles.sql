-- Adiciona uma política de segurança para permitir que os usuários
-- insiram seu próprio perfil na tabela 'perfis'.
-- Isso é necessário para que a função 'upsert' funcione corretamente,
-- garantindo que um usuário possa criar seu perfil caso ele não exista.
CREATE POLICY "Users can insert their own profile"
ON public.perfis FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
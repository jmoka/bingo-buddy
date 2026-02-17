-- Adiciona uma política de segurança para permitir que administradores
-- atualizem o perfil de qualquer usuário.
-- Isso é necessário para que a função de gerenciamento de créditos
-- no painel de administração funcione corretamente.
CREATE POLICY "Admins can update any profile"
ON public.perfis FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());
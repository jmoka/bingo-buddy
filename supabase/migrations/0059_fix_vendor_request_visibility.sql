-- Adiciona políticas de segurança para permitir a visualização de solicitações de vendedor.
-- Sem essas regras, nem o usuário que criou nem o administrador conseguiam ver os registros.

-- 1. Permite que o usuário autenticado veja suas próprias solicitações.
-- Isso é crucial para que o usuário possa acompanhar o status (pendente, aprovado, rejeitado).
CREATE POLICY "usuario ve propria solicitacao"
ON public.solicitacoes_vendedor
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Permite que usuários com a role 'admin' ou 'dev' (verificado pela função is_admin()) vejam TODAS as solicitações.
-- Isso é essencial para que o painel do administrador possa listar e processar os pedidos pendentes.
CREATE POLICY "admin ve todas solicitacoes"
ON public.solicitacoes_vendedor
FOR SELECT
TO authenticated
USING (is_admin());
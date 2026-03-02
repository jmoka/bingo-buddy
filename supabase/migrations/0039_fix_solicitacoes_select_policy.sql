DROP POLICY IF EXISTS "usuario ve proprias solicitacoes" ON solicitacoes_vendedor;

CREATE POLICY "usuario ve proprias solicitacoes" ON solicitacoes_vendedor
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

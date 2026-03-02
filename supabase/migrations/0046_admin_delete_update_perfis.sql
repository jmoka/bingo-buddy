-- Permitir admin deletar e atualizar perfis
CREATE POLICY "admin pode deletar perfis" ON perfis
  FOR DELETE USING (is_admin());

CREATE POLICY "admin pode atualizar perfis" ON perfis
  FOR UPDATE USING (is_admin());

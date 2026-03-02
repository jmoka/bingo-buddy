-- Execute este SQL no Supabase SQL Editor para restaurar o role do admin
UPDATE perfis SET role = 'admin'
WHERE id IN (
  SELECT p.id FROM perfis p
  JOIN vendedores_rifa v ON v.user_id = p.id
  WHERE p.role = 'vendedor'
  AND p.id = auth.uid()
);

-- Se o acima não funcionar (pois auth.uid() pode não funcionar no SQL Editor),
-- use este para ver os usuários afetados:
SELECT id, full_name, role FROM perfis WHERE role = 'vendedor';

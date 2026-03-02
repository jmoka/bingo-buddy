-- Vendedor precisa ver suas próprias compras (reservas feitas por ele)
-- A policy anterior só permitia comprador_id = auth.uid() ou admin
-- mas compras de vendedor têm comprador_id = NULL

DROP POLICY IF EXISTS "usuario ve proprias compras" ON compras_rifa;

CREATE POLICY "usuario ve proprias compras" ON compras_rifa
FOR SELECT USING (
  auth.uid() = comprador_id
  OR is_admin()
  OR auth.uid() = (SELECT user_id FROM vendedores_rifa WHERE id = compras_rifa.vendedor_id AND ativo = true)
);

-- Garante que o vendedor possa ver as compras (fiados e pagos) onde ele é o vendedor_id ou ref_vendedor_id
DROP POLICY IF EXISTS "Vendedor read own compras_rifa" ON public.compras_rifa;

CREATE POLICY "Vendedor read own compras_rifa" ON public.compras_rifa
FOR SELECT TO authenticated
USING (
  vendedor_id IN (SELECT id FROM public.vendedores_rifa WHERE user_id = auth.uid())
  OR
  ref_vendedor_id IN (SELECT id FROM public.vendedores_rifa WHERE user_id = auth.uid())
);
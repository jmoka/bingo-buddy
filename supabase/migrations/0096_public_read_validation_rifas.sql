-- Permitir que qualquer pessoa leia as cartelas e compras da rifa para validação do código QR

DROP POLICY IF EXISTS "Public read access for validation cartelas" ON public.cartelas_rifa;
CREATE POLICY "Public read access for validation cartelas" ON public.cartelas_rifa FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for validation compras" ON public.compras_rifa;
CREATE POLICY "Public read access for validation compras" ON public.compras_rifa FOR SELECT USING (true);
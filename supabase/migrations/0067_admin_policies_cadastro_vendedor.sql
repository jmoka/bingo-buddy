-- Permite que administradores insiram, atualizem e deletem qualquer cadastro de vendedor
CREATE POLICY "Admins can manage all cadastro_vendedor" ON public.cadastro_vendedor
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
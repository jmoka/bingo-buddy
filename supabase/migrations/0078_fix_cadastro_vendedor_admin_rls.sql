-- Permite que administradores insiram novos registros na tabela cadastro_vendedor
CREATE POLICY "Admin_Insert_Cadastro_Vendedor" ON public.cadastro_vendedor
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Permite que administradores atualizem qualquer registro na tabela cadastro_vendedor
CREATE POLICY "Admin_Update_Cadastro_Vendedor" ON public.cadastro_vendedor
FOR UPDATE TO authenticated USING (public.is_admin());
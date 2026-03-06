-- Adiciona políticas para permitir que administradores editem e excluam rifas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rifas' AND policyname = 'Admins_update_rifas') THEN
        CREATE POLICY "Admins_update_rifas" ON public.rifas FOR UPDATE TO authenticated USING (public.is_admin());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rifas' AND policyname = 'Admins_delete_rifas') THEN
        CREATE POLICY "Admins_delete_rifas" ON public.rifas FOR DELETE TO authenticated USING (public.is_admin());
    END IF;
END $$;
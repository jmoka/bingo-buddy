-- Drop the incorrect policy that was comparing auth.uid() with the seller record's own ID (id)
DROP POLICY IF EXISTS "vendedor ve proprio perfil" ON public.vendedores_rifa;

-- Create the correct policy that compares auth.uid() with the user's ID column (user_id)
CREATE POLICY "vendedores_podem_ver_proprio_perfil" ON public.vendedores_rifa
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
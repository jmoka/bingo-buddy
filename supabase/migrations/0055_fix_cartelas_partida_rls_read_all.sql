-- Drop restrictive select policy on match cards
DROP POLICY IF EXISTS "Users can view their own match cards" ON public.cartelas_partida;

-- Allow all authenticated users to read all match cards
-- This is necessary for seeing the winner's card and participant counts in the lobby
CREATE POLICY "Users can view all match cards" ON public.cartelas_partida
FOR SELECT TO authenticated USING (true);
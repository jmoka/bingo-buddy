-- Drop the overly broad policy that covers all actions
DROP POLICY IF EXISTS "Users can manage their own cards" ON public.cartelas_jogador;

-- Create a specific policy for allowing users to view their own cards
CREATE POLICY "Users can view their own cards"
ON public.cartelas_jogador FOR SELECT
TO authenticated
USING (auth.uid() = player_id);

-- Create a specific policy for allowing users to insert cards for themselves
CREATE POLICY "Users can insert their own cards"
ON public.cartelas_jogador FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = player_id);

-- Create a specific policy for allowing users to update their own cards
CREATE POLICY "Users can update their own cards"
ON public.cartelas_jogador FOR UPDATE
TO authenticated
USING (auth.uid() = player_id)
WITH CHECK (auth.uid() = player_id);

-- Create a specific policy for allowing users to delete their own cards
CREATE POLICY "Users can delete their own cards"
ON public.cartelas_jogador FOR DELETE
TO authenticated
USING (auth.uid() = player_id);
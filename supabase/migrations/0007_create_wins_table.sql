-- Create the vitorias (wins) table
CREATE TABLE public.vitorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_card_id UUID NOT NULL REFERENCES public.cartelas_jogador(id) ON DELETE SET NULL,
  match_card_id UUID NOT NULL REFERENCES public.cartelas_partida(id) ON DELETE CASCADE,
  prize_details JSONB NOT NULL,
  won_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.vitorias ENABLE ROW LEVEL SECURITY;

-- Add comments to describe the table and columns
COMMENT ON TABLE public.vitorias IS 'Registra cada vitória de um jogador em uma partida.';
COMMENT ON COLUMN public.vitorias.match_id IS 'ID da partida em que a vitória ocorreu.';
COMMENT ON COLUMN public.vitorias.player_id IS 'ID do jogador que venceu.';
COMMENT ON COLUMN public.vitorias.player_card_id IS 'ID da cartela do jogador (o template) que venceu.';
COMMENT ON COLUMN public.vitorias.match_card_id IS 'ID da cartela da partida (a instância) que venceu.';
COMMENT ON COLUMN public.vitorias.prize_details IS 'Detalhes do prêmio no momento da vitória.';
COMMENT ON COLUMN public.vitorias.won_at IS 'Timestamp de quando a vitória foi registrada.';

-- RLS Policies
-- 1. Users can view their own wins
CREATE POLICY "Users can view their own wins"
ON public.vitorias
FOR SELECT
TO authenticated
USING (auth.uid() = player_id);

-- 2. Admins can view all wins
CREATE POLICY "Admins can view all wins"
ON public.vitorias
FOR SELECT
TO authenticated
USING (is_admin());

-- Note: Inserts are handled by the 'call-number' edge function using the service_role key,
-- which bypasses RLS. Therefore, no INSERT policy is needed for authenticated users.
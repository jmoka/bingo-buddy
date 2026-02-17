-- Tabela para armazenar o histórico de vitórias
CREATE TABLE public.vitorias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.partidas(id) ON DELETE SET NULL,
  player_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  player_card_id uuid NOT NULL REFERENCES public.cartelas_jogador(id) ON DELETE CASCADE,
  match_card_id uuid NOT NULL REFERENCES public.cartelas_partida(id) ON DELETE CASCADE,
  prize_details jsonb NOT NULL,
  won_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilita RLS
ALTER TABLE public.vitorias ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
-- Admins podem ver todas as vitórias
CREATE POLICY "Admins can view all wins"
ON public.vitorias FOR SELECT
TO authenticated
USING (is_admin());

-- Usuários podem ver suas próprias vitórias
CREATE POLICY "Users can view their own wins"
ON public.vitorias FOR SELECT
TO authenticated
USING (auth.uid() = player_id);
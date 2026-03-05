-- Adiciona coluna credit_type na tabela cartelas_partida
ALTER TABLE public.cartelas_partida 
ADD COLUMN IF NOT EXISTS credit_type text NOT NULL DEFAULT 'real';

-- Atualiza registros existentes com o credit_type da cartela original
UPDATE public.cartelas_partida cp
SET credit_type = cj.credit_type
FROM public.cartelas_jogador cj
WHERE cp.player_card_id = cj.id;

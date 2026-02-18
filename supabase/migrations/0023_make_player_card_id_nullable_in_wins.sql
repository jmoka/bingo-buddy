-- Altera a coluna player_card_id para ser opcional (nullable)
ALTER TABLE public.vitorias ALTER COLUMN player_card_id DROP NOT NULL;

-- Garante que se a cartela for deletada, a referência na vitória vire NULL em vez de dar erro
ALTER TABLE public.vitorias 
DROP CONSTRAINT IF EXISTS vitorias_player_card_id_fkey,
ADD CONSTRAINT vitorias_player_card_id_fkey 
  FOREIGN KEY (player_card_id) 
  REFERENCES public.cartelas_jogador(id) 
  ON DELETE SET NULL;
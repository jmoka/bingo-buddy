-- 1. Garante que a coluna de arquivamento existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cartelas_jogador' AND column_name='is_archived') THEN
        ALTER TABLE public.cartelas_jogador ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Ajusta constraint em vitorias (caso a migração anterior tenha falhado ou seja parcial)
ALTER TABLE public.vitorias ALTER COLUMN player_card_id DROP NOT NULL;
ALTER TABLE public.vitorias DROP CONSTRAINT IF EXISTS vitorias_player_card_id_fkey;
ALTER TABLE public.vitorias ADD CONSTRAINT vitorias_player_card_id_fkey 
    FOREIGN KEY (player_card_id) REFERENCES public.cartelas_jogador(id) ON DELETE SET NULL;

-- 3. Ajusta constraint em cartelas_partida para permitir deletar a "mãe" (player_card)
ALTER TABLE public.cartelas_partida ALTER COLUMN player_card_id DROP NOT NULL;
ALTER TABLE public.cartelas_partida DROP CONSTRAINT IF EXISTS cartelas_partida_player_card_id_fkey;
ALTER TABLE public.cartelas_partida ADD CONSTRAINT cartelas_partida_player_card_id_fkey 
    FOREIGN KEY (player_card_id) REFERENCES public.cartelas_jogador(id) ON DELETE SET NULL;

-- 4. Garante que as políticas de RLS permitem o update e delete pelo dono
DROP POLICY IF EXISTS "Users can update their own cards" ON public.cartelas_jogador;
CREATE POLICY "Users can update their own cards" ON public.cartelas_jogador
    FOR UPDATE TO authenticated USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can delete their own cards" ON public.cartelas_jogador;
CREATE POLICY "Users can delete their own cards" ON public.cartelas_jogador
    FOR DELETE TO authenticated USING (auth.uid() = player_id);
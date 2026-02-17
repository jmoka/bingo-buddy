-- Adiciona a coluna min_players à tabela de partidas, com um valor padrão seguro.
ALTER TABLE public.partidas
ADD COLUMN min_players INTEGER NOT NULL DEFAULT 1;
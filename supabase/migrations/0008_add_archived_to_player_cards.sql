-- Adiciona a coluna para controlar o status de arquivamento de uma cartela.
-- O valor padrão é 'false', então todas as cartelas existentes não serão arquivadas.
ALTER TABLE public.cartelas_jogador
ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;
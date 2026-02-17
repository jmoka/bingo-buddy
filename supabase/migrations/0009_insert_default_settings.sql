-- Insere uma linha de configuração padrão se a tabela estiver vazia.
-- A restrição UNIQUE na coluna 'singleton' garante que apenas uma linha pode ser inserida.
INSERT INTO public.configuracoes (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;
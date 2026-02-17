-- Adiciona colunas para a integração com n8n na tabela de configurações
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS n8n_test_url TEXT,
ADD COLUMN IF NOT EXISTS n8n_prod_url TEXT,
ADD COLUMN IF NOT EXISTS n8n_env TEXT DEFAULT 'test';

-- Garante que a linha existente tenha um valor padrão para o ambiente, caso ainda não tenha
UPDATE public.configuracoes
SET n8n_env = 'test'
WHERE n8n_env IS NULL;
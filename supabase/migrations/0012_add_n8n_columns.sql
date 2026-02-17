-- Adiciona colunas para integração com n8n que estavam faltando no esquema
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS n8n_test_url TEXT,
ADD COLUMN IF NOT EXISTS n8n_prod_url TEXT,
ADD COLUMN IF NOT EXISTS n8n_env TEXT CHECK (n8n_env IN ('test', 'production')) DEFAULT 'test';
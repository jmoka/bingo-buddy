-- Adiciona a coluna valor_por_credito na tabela configuracoes
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS valor_por_credito NUMERIC DEFAULT 1.0;

-- Adiciona colunas na tabela solicitacoes_credito para rastrear o que foi pedido e pago
ALTER TABLE public.solicitacoes_credito ADD COLUMN IF NOT EXISTS credits_requested INTEGER;
ALTER TABLE public.solicitacoes_credito ADD COLUMN IF NOT EXISTS amount_paid NUMERIC;
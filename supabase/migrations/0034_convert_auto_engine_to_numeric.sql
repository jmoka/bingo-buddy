-- Altera as colunas do motor automático para suportar decimais
ALTER TABLE public.configuracoes 
  ALTER COLUMN auto_engine_card_price TYPE numeric(10,2),
  ALTER COLUMN auto_engine_prize_value TYPE numeric(10,2);

-- Garante que as colunas de custo também sejam numeric (caso não sejam)
ALTER TABLE public.configuracoes 
  ALTER COLUMN custo_nova_cartela TYPE numeric(10,2),
  ALTER COLUMN custo_recarga_cartela TYPE numeric(10,2);
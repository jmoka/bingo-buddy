-- Adiciona uma coluna para rastrear o lucro total do admin nas configurações
ALTER TABLE public.configuracoes
ADD COLUMN admin_profit INTEGER NOT NULL DEFAULT 0;

-- Adiciona uma coluna para registrar o lucro do admin em cada partida específica
ALTER TABLE public.partidas
ADD COLUMN admin_profit_from_match INTEGER NOT NULL DEFAULT 0;

-- Cria uma função para zerar o lucro do admin de forma segura
CREATE OR REPLACE FUNCTION public.reset_admin_profit()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.configuracoes SET admin_profit = 0 WHERE singleton = true;
$$;

-- Cria uma função para incrementar o lucro do admin de forma atômica
CREATE OR REPLACE FUNCTION public.increment_admin_profit(amount integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.configuracoes SET admin_profit = admin_profit + amount WHERE singleton = true;
$$;
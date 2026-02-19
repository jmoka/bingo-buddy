-- Remove a função antiga que apenas zerava o lucro
DROP FUNCTION IF EXISTS public.reset_admin_profit();

-- Cria uma nova função para retirar uma quantidade específica de lucro
CREATE OR REPLACE FUNCTION public.withdraw_admin_profit(amount_to_withdraw integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.configuracoes
  SET admin_profit = admin_profit - amount_to_withdraw
  WHERE singleton = true AND admin_profit >= amount_to_withdraw;
$$;
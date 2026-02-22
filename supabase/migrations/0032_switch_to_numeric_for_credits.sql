-- Altera a tabela de perfis para usar numeric para créditos
ALTER TABLE public.perfis ALTER COLUMN credits TYPE numeric USING credits::numeric;
ALTER TABLE public.perfis ALTER COLUMN credits SET DEFAULT 0.00;
ALTER TABLE public.perfis ALTER COLUMN fake_credits TYPE numeric USING fake_credits::numeric;
ALTER TABLE public.perfis ALTER COLUMN fake_credits SET DEFAULT 0.00;

-- Altera a tabela de partidas para usar numeric em valores financeiros
ALTER TABLE public.partidas ALTER COLUMN card_price TYPE numeric USING card_price::numeric;
ALTER TABLE public.partidas ALTER COLUMN card_price SET DEFAULT 0.00;
ALTER TABLE public.partidas ALTER COLUMN pot TYPE numeric USING pot::numeric;
ALTER TABLE public.partidas ALTER COLUMN pot SET DEFAULT 0.00;
ALTER TABLE public.partidas ALTER COLUMN admin_profit_from_match TYPE numeric USING admin_profit_from_match::numeric;
ALTER TABLE public.partidas ALTER COLUMN admin_profit_from_match SET DEFAULT 0.00;

-- Altera a tabela de configurações para usar numeric em custos e lucros
ALTER TABLE public.configuracoes ALTER COLUMN custo_nova_cartela TYPE numeric USING custo_nova_cartela::numeric;
ALTER TABLE public.configuracoes ALTER COLUMN custo_nova_cartela SET DEFAULT 10.00;
ALTER TABLE public.configuracoes ALTER COLUMN custo_recarga_cartela TYPE numeric USING custo_recarga_cartela::numeric;
ALTER TABLE public.configuracoes ALTER COLUMN custo_recarga_cartela SET DEFAULT 5.00;
ALTER TABLE public.configuracoes ALTER COLUMN admin_profit TYPE numeric USING admin_profit::numeric;
ALTER TABLE public.configuracoes ALTER COLUMN admin_profit SET DEFAULT 0.00;

-- Altera a tabela de solicitações de crédito
ALTER TABLE public.solicitacoes_credito ALTER COLUMN credits_granted TYPE numeric USING credits_granted::numeric;
ALTER TABLE public.solicitacoes_credito ALTER COLUMN credits_requested TYPE numeric USING credits_requested::numeric;
ALTER TABLE public.solicitacoes_credito ALTER COLUMN amount_paid TYPE numeric USING amount_paid::numeric;

-- Altera a tabela de solicitações de resgate
ALTER TABLE public.solicitacoes_resgate ALTER COLUMN credits_requested TYPE numeric USING credits_requested::numeric;
ALTER TABLE public.solicitacoes_resgate ALTER COLUMN amount_to_receive TYPE numeric USING amount_to_receive::numeric;

-- Atualiza funções que lidam com créditos para garantir compatibilidade
DROP FUNCTION IF EXISTS public.increment_player_credits(uuid, integer);
CREATE OR REPLACE FUNCTION public.increment_player_credits(p_player_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  update public.perfis
  set credits = credits + p_amount
  where id = p_player_id;
end;
$function$;

DROP FUNCTION IF EXISTS public.withdraw_admin_profit(integer);
CREATE OR REPLACE FUNCTION public.withdraw_admin_profit(amount_to_withdraw numeric)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  UPDATE public.configuracoes
  SET admin_profit = admin_profit - amount_to_withdraw
  WHERE singleton = true AND admin_profit >= amount_to_withdraw;
$function$;

DROP FUNCTION IF EXISTS public.increment_admin_profit(integer);
CREATE OR REPLACE FUNCTION public.increment_admin_profit(amount numeric)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  UPDATE public.configuracoes SET admin_profit = admin_profit + amount WHERE singleton = true;
$function$;
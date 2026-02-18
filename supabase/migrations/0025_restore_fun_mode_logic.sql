-- Atualiza a função de compra de cartela para não cobrar por cartelas 'fake'
CREATE OR REPLACE FUNCTION public.buy_player_card(p_name text, p_numbers jsonb, p_credit_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_cost int;
  v_balance int;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  -- Se for de brincar, o custo é zero e não precisa de saldo
  IF p_credit_type = 'fake' THEN
    v_cost := 0;
  ELSE
    SELECT custo_nova_cartela INTO v_cost FROM public.configuracoes LIMIT 1;
    IF v_cost IS NULL THEN v_cost := 10; END IF;
  END IF;

  -- Verifica saldo e realiza o débito apenas se houver custo
  IF v_cost > 0 THEN
    IF p_credit_type = 'real' THEN
      SELECT credits INTO v_balance FROM public.perfis WHERE id = v_user_id;
      IF v_balance IS NULL OR v_balance < v_cost THEN 
        RAISE EXCEPTION 'Saldo insuficiente de créditos reais.'; 
      END IF;
      UPDATE public.perfis SET credits = credits - v_cost WHERE id = v_user_id;
    ELSIF p_credit_type = 'fake' THEN
      -- Teoricamente v_cost é 0 aqui, mas deixamos a lógica se quiserem cobrar fake_credits no futuro
      SELECT fake_credits INTO v_balance FROM public.perfis WHERE id = v_user_id;
      IF v_balance IS NULL OR v_balance < v_cost THEN 
        RAISE EXCEPTION 'Saldo de brincar insuficiente.'; 
      END IF;
      UPDATE public.perfis SET fake_credits = fake_credits - v_cost WHERE id = v_user_id;
    END IF;
  END IF;

  -- Insere a cartela
  INSERT INTO public.cartelas_jogador (player_id, name, numbers, credit_type, uses_left)
  VALUES (v_user_id, p_name, p_numbers, p_credit_type, 1)
  RETURNING to_jsonb(cartelas_jogador.*) INTO v_result;

  RETURN v_result;
END;
$function$;
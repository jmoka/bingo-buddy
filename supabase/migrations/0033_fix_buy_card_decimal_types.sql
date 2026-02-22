-- Atualiza a função buy_player_card para usar numeric em vez de int
CREATE OR REPLACE FUNCTION public.buy_player_card(p_name text, p_numbers jsonb, p_credit_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_cost numeric; -- Alterado de int para numeric
  v_uses int;
  v_balance numeric; -- Alterado de int para numeric
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  -- 1. Pega o custo e os usos da configuração
  SELECT custo_nova_cartela, usos_por_recarga INTO v_cost, v_uses FROM public.configuracoes LIMIT 1;
  IF v_cost IS NULL THEN
    v_cost := 10.0; -- Fallback seguro
  END IF;
  IF v_uses IS NULL OR v_uses < 1 THEN
    v_uses := 1; -- Fallback seguro
  END IF;

  -- 2. Verifica saldo e realiza o débito
  IF p_credit_type = 'real' THEN
    -- Verifica saldo real
    SELECT credits INTO v_balance FROM public.perfis WHERE id = v_user_id;
    IF v_balance IS NULL OR v_balance < v_cost THEN 
      RAISE EXCEPTION 'Saldo insuficiente de créditos reais.'; 
    END IF;
    -- Debita
    UPDATE public.perfis SET credits = credits - v_cost WHERE id = v_user_id;
    
  ELSIF p_credit_type = 'fake' THEN
    -- Verifica saldo fake
    SELECT fake_credits INTO v_balance FROM public.perfis WHERE id = v_user_id;
    IF v_balance IS NULL OR v_balance < v_cost THEN 
      RAISE EXCEPTION 'Saldo de brincar insuficiente.'; 
    END IF;
    -- Debita
    UPDATE public.perfis SET fake_credits = fake_credits - v_cost WHERE id = v_user_id;
    
  ELSE
    RAISE EXCEPTION 'Tipo de crédito inválido: %', p_credit_type;
  END IF;

  -- 3. Insere a cartela com os usos configurados
  INSERT INTO public.cartelas_jogador (player_id, name, numbers, credit_type, uses_left)
  VALUES (v_user_id, p_name, p_numbers, p_credit_type, v_uses)
  RETURNING to_jsonb(cartelas_jogador.*) INTO v_result;

  RETURN v_result;
END;
$function$;
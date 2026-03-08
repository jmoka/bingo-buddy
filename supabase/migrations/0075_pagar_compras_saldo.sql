-- Função para o vendedor pagar compras "fiadas" usando seu próprio saldo de créditos do sistema
CREATE OR REPLACE FUNCTION public.pagar_compras_saldo(p_compra_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_total NUMERIC := 0;
  v_compra record;
BEGIN
  -- Somar total das compras que estão pendentes e pertencem a esse vendedor
  FOR v_compra IN 
    SELECT cr.* FROM compras_rifa cr
    JOIN vendedores_rifa vr ON vr.id = cr.vendedor_id
    WHERE cr.id = ANY(p_compra_ids) 
      AND cr.status = 'pendente' 
      AND vr.user_id = v_user_id
  LOOP
    v_total := v_total + v_compra.valor_total;
  END LOOP;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma compra pendente encontrada ou já paga.');
  END IF;

  -- Checar saldo do usuário
  IF (SELECT credits FROM perfis WHERE id = v_user_id) < v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  -- Debitar saldo
  UPDATE perfis SET credits = credits - v_total WHERE id = v_user_id;

  -- Atualizar status das compras para 'pago'
  UPDATE compras_rifa SET status = 'pago' WHERE id = ANY(p_compra_ids) AND status = 'pendente';

  RETURN jsonb_build_object('success', true, 'total_pago', v_total);
END;
$function$;
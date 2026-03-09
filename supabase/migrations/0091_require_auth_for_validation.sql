-- 1. Recria a função removendo a permissão para 'anon' e mantendo apenas para logados
CREATE OR REPLACE FUNCTION public.enviar_comprovante_cliente_bingo(
    p_codigo text, 
    p_nome text, 
    p_telefone text DEFAULT NULL, 
    p_endereco text DEFAULT NULL, 
    p_comprovante text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda_id uuid;
  v_user_id uuid := auth.uid(); -- Pega o ID do usuário logado
BEGIN
  -- Bloqueio extra: Verifica se existe usuário logado na sessão
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Busca a venda pendente
  SELECT id INTO v_venda_id 
  FROM public.vendas_bingo_fisico 
  WHERE codigo_validacao = upper(p_codigo) 
    AND status = 'pendente'
  LIMIT 1;
  
  IF v_venda_id IS NULL THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Cartela não encontrada ou já validada.'); 
  END IF;
  
  -- Atualiza os dados, vinculando opcionalmente o ID do usuário se quiser auditoria futura
  UPDATE public.vendas_bingo_fisico 
  SET status = 'em_analise', 
      nome_comprador = p_nome, 
      telefone_comprador = p_telefone, 
      endereco_comprador = p_endereco,
      comprovante_url = p_comprovante
  WHERE id = v_venda_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Revoga acesso de anônimos e garante acesso de logados
REVOKE EXECUTE ON FUNCTION public.enviar_comprovante_cliente_bingo(text, text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.enviar_comprovante_cliente_bingo(text, text, text, text, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.enviar_comprovante_cliente_bingo(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_comprovante_cliente_bingo(text, text, text, text, text) TO service_role;
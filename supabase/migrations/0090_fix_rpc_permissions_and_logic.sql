-- 1. Garante que a função seja recriada com o dono correto e permissões totais
CREATE OR REPLACE FUNCTION public.enviar_comprovante_cliente_bingo(
    p_codigo text, 
    p_nome text, 
    p_telefone text DEFAULT NULL, 
    p_endereco text DEFAULT NULL, 
    p_comprovante text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Roda como administrador, ignorando bloqueios de RLS na tabela
SET search_path = public -- Segurança: evita ataques de busca de schema
AS $$
DECLARE
  v_venda_id uuid;
BEGIN
  -- Busca a venda pendente pelo código
  SELECT id INTO v_venda_id 
  FROM public.vendas_bingo_fisico 
  WHERE codigo_validacao = upper(p_codigo) 
    AND status = 'pendente'
  LIMIT 1;
  
  IF v_venda_id IS NULL THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Cartela não encontrada ou já validada.'); 
  END IF;
  
  -- Atualiza os dados da cartela
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

-- 2. ESSENCIAL: Dá permissão para usuários NÃO LOGADOS (anon) e LOGADOS executarem a função
GRANT EXECUTE ON FUNCTION public.enviar_comprovante_cliente_bingo(text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.enviar_comprovante_cliente_bingo(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_comprovante_cliente_bingo(text, text, text, text, text) TO service_role;
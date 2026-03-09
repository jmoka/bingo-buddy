-- 1. Recriar a função garantindo que ela rode como administrador (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.enviar_comprovante_cliente_bingo(
    p_codigo text, 
    p_nome text, 
    p_telefone text DEFAULT NULL::text, 
    p_endereco text DEFAULT NULL::text, 
    p_comprovante text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_venda_id uuid;
BEGIN
  -- Busca a venda pendente pelo código
  SELECT id INTO v_venda_id 
  FROM public.vendas_bingo_fisico 
  WHERE upper(codigo_validacao) = upper(p_codigo) 
    AND status = 'pendente'
  LIMIT 1;
  
  IF v_venda_id IS NULL THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Cartela não encontrada ou já validada.'); 
  END IF;
  
  -- Atualiza os dados
  UPDATE public.vendas_bingo_fisico 
  SET status = 'em_analise', 
      nome_comprador = p_nome, 
      telefone_comprador = p_telefone, 
      endereco_comprador = p_endereco,
      comprovante_url = p_comprovante
  WHERE id = v_venda_id;
  
  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 2. LIBERAR EXECUÇÃO PARA ANÔNIMOS (Visitantes sem login)
-- Isso resolve o erro de "Permission Denied"
GRANT EXECUTE ON FUNCTION public.enviar_comprovante_cliente_bingo(text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.enviar_comprovante_cliente_bingo(text, text, text, text, text) TO authenticated;

-- 3. Garantir permissões de leitura na tabela para a busca funcionar sem login
ALTER TABLE public.vendas_bingo_fisico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for validation" ON public.vendas_bingo_fisico;
CREATE POLICY "Public read access for validation" ON public.vendas_bingo_fisico
FOR SELECT USING (true);
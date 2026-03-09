-- 1. Garante que a coluna existe
ALTER TABLE public.vendas_bingo_fisico ADD COLUMN IF NOT EXISTS endereco_comprador TEXT;

-- 2. Remove as versões antigas da função para evitar ambiguidade (4 ou 5 parâmetros)
DROP FUNCTION IF EXISTS public.enviar_comprovante_cliente_bingo(text, text, text, text);
DROP FUNCTION IF EXISTS public.enviar_comprovante_cliente_bingo(text, text, text, text, text);

-- 3. Cria a função atualizada
CREATE OR REPLACE FUNCTION public.enviar_comprovante_cliente_bingo(
  p_codigo text, 
  p_nome text, 
  p_telefone text, 
  p_endereco text, 
  p_comprovante text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venda vendas_bingo_fisico%ROWTYPE;
BEGIN
  SELECT * INTO v_venda FROM vendas_bingo_fisico WHERE codigo_validacao = p_codigo AND status = 'pendente';
  
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Cartela não encontrada ou já paga.'); 
  END IF;
  
  UPDATE vendas_bingo_fisico 
  SET status = 'em_analise', 
      nome_comprador = p_nome, 
      telefone_comprador = p_telefone, 
      endereco_comprador = p_endereco,
      comprovante_url = p_comprovante
  WHERE id = v_venda.id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Força a API do Supabase a recarregar o cache do schema na mesma hora
NOTIFY pgrst, 'reload schema';
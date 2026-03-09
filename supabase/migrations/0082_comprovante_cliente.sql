-- 1. Adicionar coluna para armazenar o comprovante enviado pelo cliente
ALTER TABLE public.vendas_bingo_fisico ADD COLUMN IF NOT EXISTS comprovante_url TEXT;

-- 2. Função para o cliente enviar o comprovante (Acesso Público/Anônimo)
CREATE OR REPLACE FUNCTION public.enviar_comprovante_cliente_bingo(p_codigo text, p_nome text, p_telefone text, p_comprovante text)
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
      comprovante_url = p_comprovante
  WHERE id = v_venda.id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Função para o Admin aprovar o PIX do cliente e pagar a comissão do vendedor
CREATE OR REPLACE FUNCTION public.aprovar_pagamento_cliente_bingo(p_venda_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venda vendas_bingo_fisico%ROWTYPE;
  v_vendedor vendedores_rifa%ROWTYPE;
  v_comissao NUMERIC := 0;
BEGIN
  -- Busca a venda
  SELECT * INTO v_venda FROM vendas_bingo_fisico WHERE id = p_venda_id AND status = 'em_analise';
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada ou não está em análise.'); 
  END IF;
  
  -- Atualiza para pago
  UPDATE vendas_bingo_fisico SET status = 'pago' WHERE id = p_venda_id;
  
  -- Calcula a comissão do vendedor
  -- O valor_pago registrado na tabela é o valor COM desconto (o que o admin recebe líquido).
  -- A comissão do vendedor é a diferença entre o valor CHEIO pago pelo cliente e o valor líquido do admin.
  IF v_venda.desconto_aplicado > 0 THEN
     v_comissao := (v_venda.valor_pago / (1 - (v_venda.desconto_aplicado / 100.0))) - v_venda.valor_pago;
     
     -- Credita a comissão na conta do vendedor
     SELECT * INTO v_vendedor FROM vendedores_rifa WHERE id = v_venda.vendedor_id;
     IF FOUND AND v_vendedor.user_id IS NOT NULL THEN
        UPDATE perfis SET credits = credits + v_comissao WHERE id = v_vendedor.user_id;
     END IF;
  END IF;

  -- Adiciona o valor líquido ao Pote da Partida
  UPDATE partidas SET pot = pot + v_venda.valor_pago WHERE id = v_venda.match_id;
  
  RETURN jsonb_build_object('success', true, 'comissao_paga', v_comissao);
END;
$$;

-- 4. Função para o Admin rejeitar o comprovante do cliente
CREATE OR REPLACE FUNCTION public.rejeitar_pagamento_cliente_bingo(p_venda_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE vendas_bingo_fisico 
  SET status = 'pendente', comprovante_url = NULL 
  WHERE id = p_venda_id AND status = 'em_analise';
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Permitir upload anonimo na pasta de comprovantes dentro do bucket publico avatars
CREATE POLICY "Permitir upload publico de comprovantes bingo" 
ON storage.objects FOR INSERT TO public 
WITH CHECK (bucket_id = 'avatars');
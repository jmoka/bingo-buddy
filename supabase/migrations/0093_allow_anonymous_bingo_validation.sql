-- 1. Atualizar a função para permitir user_id nulo
CREATE OR REPLACE FUNCTION public.enviar_comprovante_cliente_bingo(p_codigo text, p_nome text, p_telefone text DEFAULT NULL::text, p_endereco text DEFAULT NULL::text, p_comprovante text DEFAULT NULL::text)
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
  WHERE codigo_validacao = upper(p_codigo) 
    AND status = 'pendente'
  LIMIT 1;
  
  IF v_venda_id IS NULL THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Cartela não encontrada ou já validada.'); 
  END IF;
  
  -- Atualiza os dados (sem exigir auth.uid())
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

-- 2. Garantir que anônimos podem inserir arquivos no bucket de comprovantes
-- Nota: O bucket já deve existir (criado na migration 0087)
DO $$
BEGIN
    -- Política para permitir upload anônimo
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Anonymous Uploads' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Allow Anonymous Uploads" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'comprovantes_bingo');
    END IF;

    -- Política para permitir leitura anônima (para o admin e o próprio cliente ver)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Anonymous Read' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Allow Anonymous Read" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'comprovantes_bingo');
    END IF;
END $$;
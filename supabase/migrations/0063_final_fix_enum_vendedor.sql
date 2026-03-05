-- Esta migração foca exclusivamente em garantir que o cargo 'vendedor' seja aceito.
-- Usamos um comando direto que costuma funcionar melhor fora de blocos complexos.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'vendedor';

-- Também vamos garantir que a função aprovar_vendedor trate o erro de cargo de forma elegante
CREATE OR REPLACE FUNCTION public.aprovar_vendedor(p_solicitacao_id uuid, p_comissao numeric DEFAULT 0, p_desconto numeric DEFAULT 0, p_mensagem_admin text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_caller_role TEXT;
  v_solicitacao solicitacoes_vendedor%ROWTYPE;
  v_vendedor_id UUID;
  v_codigo_ref TEXT;
  v_user_current_role TEXT;
  v_sol_id UUID := p_solicitacao_id;
BEGIN
  -- 1. Verifica permissão do autor da chamada
  SELECT role INTO v_caller_role FROM perfis WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'dev') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized', 'details', 'Apenas admins podem aprovar vendedores');
  END IF;

  -- 2. Busca a solicitação
  SELECT * INTO v_solicitacao FROM solicitacoes_vendedor WHERE id = v_sol_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found', 'details', 'Solicitação não encontrada');
  END IF;

  -- 3. Tenta atualizar o cargo do usuário (Aqui é onde o erro do Enum costuma acontecer)
  BEGIN
    SELECT role INTO v_user_current_role FROM perfis WHERE id = v_solicitacao.user_id;
    IF v_user_current_role != 'admin' AND v_user_current_role != 'dev' THEN
      UPDATE perfis SET role = 'vendedor' WHERE id = v_solicitacao.user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'database_error', 'details', 'Erro ao atualizar cargo: ' || SQLERRM);
  END;

  -- 4. Cria ou atualiza o registro na tabela de vendedores
  v_codigo_ref := upper(substr(md5(v_solicitacao.user_id::text || random()::text), 1, 8));

  INSERT INTO vendedores_rifa (user_id, nome, documento, telefone, comissao_percentual, percentual_desconto, codigo_ref, ativo)
  VALUES (v_solicitacao.user_id, v_solicitacao.nome, v_solicitacao.documento, v_solicitacao.telefone, p_comissao, p_desconto, v_codigo_ref, true)
  ON CONFLICT (user_id) DO UPDATE
    SET comissao_percentual = p_comissao, percentual_desconto = p_desconto, ativo = true, codigo_ref = COALESCE(vendedores_rifa.codigo_ref, v_codigo_ref)
  RETURNING id INTO v_vendedor_id;

  -- 5. Finaliza a solicitação
  UPDATE solicitacoes_vendedor
  SET status = 'aprovado',
      mensagem_admin = p_mensagem_admin,
      resolved_at = now(),
      resolved_by = auth.uid()
  WHERE id = v_sol_id;

  RETURN jsonb_build_object('success', true, 'vendedor_id', v_vendedor_id);
END;
$function$;
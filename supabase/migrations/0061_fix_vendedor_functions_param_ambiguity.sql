-- This migration updates the aprovar_vendedor and rejeitar_vendedor functions
-- to prevent a parameter ambiguity error. It explicitly assigns the input parameter
-- p_solicitacao_id to a local variable before using it in WHERE clauses,
-- which resolves the "column does not exist" error.

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
  v_solicitacao_id UUID := p_solicitacao_id; -- Explicitly declare a local variable
BEGIN
  SELECT role INTO v_caller_role FROM perfis WHERE id = auth.uid();
  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_solicitacao FROM solicitacoes_vendedor WHERE id = v_solicitacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  -- Check user's current role before changing it
  SELECT role INTO v_user_current_role FROM perfis WHERE id = v_solicitacao.user_id;
  IF v_user_current_role != 'admin' THEN
    UPDATE perfis SET role = 'vendedor' WHERE id = v_solicitacao.user_id;
  END IF;

  v_codigo_ref := upper(substr(md5(v_solicitacao.user_id::text || random()::text), 1, 8));

  INSERT INTO vendedores_rifa (user_id, nome, documento, telefone, comissao_percentual, percentual_desconto, codigo_ref, ativo)
  VALUES (v_solicitacao.user_id, v_solicitacao.nome, v_solicitacao.documento, v_solicitacao.telefone, p_comissao, p_desconto, v_codigo_ref, true)
  ON CONFLICT (user_id) DO UPDATE
    SET comissao_percentual = p_comissao, percentual_desconto = p_desconto, ativo = true, codigo_ref = COALESCE(vendedores_rifa.codigo_ref, v_codigo_ref)
  RETURNING id INTO v_vendedor_id;

  UPDATE solicitacoes_vendedor
  SET status = 'aprovado',
      mensagem_admin = p_mensagem_admin,
      resolved_at = now(),
      resolved_by = auth.uid()
  WHERE id = v_solicitacao_id;

  RETURN jsonb_build_object('success', true, 'vendedor_id', v_vendedor_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.rejeitar_vendedor(p_solicitacao_id uuid, p_mensagem_admin text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_caller_role TEXT;
  v_solicitacao_id UUID := p_solicitacao_id; -- Explicitly declare a local variable
BEGIN
  SELECT role INTO v_caller_role FROM perfis WHERE id = auth.uid();
  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE solicitacoes_vendedor
  SET status = 'rejeitado', mensagem_admin = p_mensagem_admin, resolved_at = now(), resolved_by = auth.uid()
  WHERE id = v_solicitacao_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;
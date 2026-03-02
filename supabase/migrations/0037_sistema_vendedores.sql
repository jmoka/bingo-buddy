-- ============================================================
-- SISTEMA DE VENDEDORES DE RIFA
-- ============================================================

-- 1. Permitir role 'vendedor' em perfis
-- (Supabase não usa CHECK constraint facilmente em ALTER, usamos política)

-- 2. Tabela de solicitações para se tornar vendedor
CREATE TABLE solicitacoes_vendedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  nome TEXT NOT NULL,
  documento TEXT,
  telefone TEXT,
  mensagem TEXT,
  mensagem_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES perfis(id)
);

ALTER TABLE solicitacoes_vendedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario ve proprias solicitacoes" ON solicitacoes_vendedor
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "usuario cria propria solicitacao" ON solicitacoes_vendedor
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "usuario cancela propria solicitacao" ON solicitacoes_vendedor
  FOR DELETE USING (auth.uid() = user_id AND status = 'pendente');
CREATE POLICY "admin gerencia solicitacoes" ON solicitacoes_vendedor
  FOR ALL USING (is_admin());

-- 3. Adicionar colunas em vendedores_rifa
ALTER TABLE vendedores_rifa
  ADD COLUMN IF NOT EXISTS codigo_ref TEXT UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 8)),
  ADD COLUMN IF NOT EXISTS comissao_percentual NUMERIC DEFAULT 0;

-- 4. Adicionar preco_vendedor em rifas ( = usa desconto global)
ALTER TABLE rifas
  ADD COLUMN IF NOT EXISTS preco_vendedor NUMERIC;

-- 5. Adicionar ref_vendedor_id em compras_rifa (para link de afiliado)
ALTER TABLE compras_rifa
  ADD COLUMN IF NOT EXISTS ref_vendedor_id UUID REFERENCES vendedores_rifa(id);

-- 6. Adicionar dados do comprador físico em numeros_rifa
ALTER TABLE numeros_rifa
  ADD COLUMN IF NOT EXISTS nome_comprador TEXT,
  ADD COLUMN IF NOT EXISTS telefone_comprador TEXT,
  ADD COLUMN IF NOT EXISTS endereco_comprador TEXT;

-- 7. Adicionar configurações de vendedor em configuracoes (game_settings)
ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS desconto_vendedor_global NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_vendedor_global NUMERIC DEFAULT 0;

-- ============================================================
-- RPCs
-- ============================================================

-- Aprovar vendedor: atualiza role, cria vendedor_rifa, atualiza solicitação
CREATE OR REPLACE FUNCTION aprovar_vendedor(
  p_solicitacao_id UUID,
  p_comissao NUMERIC DEFAULT 0,
  p_desconto NUMERIC DEFAULT 0
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role TEXT;
  v_solicitacao solicitacoes_vendedor%ROWTYPE;
  v_vendedor_id UUID;
  v_codigo_ref TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM perfis WHERE id = auth.uid();
  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_solicitacao FROM solicitacoes_vendedor WHERE id = p_solicitacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  UPDATE perfis SET role = 'vendedor' WHERE id = v_solicitacao.user_id;

  v_codigo_ref := upper(substr(md5(v_solicitacao.user_id::text || random()::text), 1, 8));

  INSERT INTO vendedores_rifa (user_id, nome, documento, telefone, comissao_percentual, percentual_desconto, codigo_ref, ativo)
  VALUES (v_solicitacao.user_id, v_solicitacao.nome, v_solicitacao.documento, v_solicitacao.telefone, p_comissao, p_desconto, v_codigo_ref, true)
  ON CONFLICT (user_id) DO UPDATE
    SET comissao_percentual = p_comissao, percentual_desconto = p_desconto, ativo = true, codigo_ref = COALESCE(vendedores_rifa.codigo_ref, v_codigo_ref)
  RETURNING id INTO v_vendedor_id;

  UPDATE solicitacoes_vendedor
  SET status = 'aprovado', resolved_at = now(), resolved_by = auth.uid()
  WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('success', true, 'vendedor_id', v_vendedor_id);
END;
$$;

-- Rejeitar vendedor
CREATE OR REPLACE FUNCTION rejeitar_vendedor(
  p_solicitacao_id UUID,
  p_mensagem_admin TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM perfis WHERE id = auth.uid();
  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE solicitacoes_vendedor
  SET status = 'rejeitado', mensagem_admin = p_mensagem_admin, resolved_at = now(), resolved_by = auth.uid()
  WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Comprar números via link de vendedor (comprador paga preço normal, vendedor recebe comissão)
CREATE OR REPLACE FUNCTION comprar_numeros_via_ref(
  p_rifa_id UUID,
  p_numeros INTEGER[],
  p_ref_codigo TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_rifa rifas%ROWTYPE;
  v_vendedor_id UUID;
  v_comissao NUMERIC;
  v_total NUMERIC;
  v_comissao_valor NUMERIC;
  v_compra_id UUID;
  v_num INT;
BEGIN
  SELECT * INTO v_rifa FROM rifas WHERE id = p_rifa_id AND status = 'ativa' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'rifa_not_found');
  END IF;

  SELECT id, comissao_percentual INTO v_vendedor_id, v_comissao
  FROM vendedores_rifa WHERE codigo_ref = p_ref_codigo AND ativo = true;

  v_total := array_length(p_numeros, 1) * v_rifa.custo_por_numero;

  IF (SELECT credits FROM perfis WHERE id = v_user_id) < v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  FOR v_num IN SELECT unnest(p_numeros) LOOP
    UPDATE numeros_rifa
    SET status = 'vendido', comprador_id = v_user_id,
        vendedor_id = v_vendedor_id
    WHERE rifa_id = p_rifa_id AND numero = v_num AND status = 'disponivel';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'numero_indisponivel:%', v_num;
    END IF;
  END LOOP;

  UPDATE perfis SET credits = credits - v_total WHERE id = v_user_id;

  INSERT INTO compras_rifa (rifa_id, comprador_id, numeros, valor_total, tipo_pagamento, ref_vendedor_id)
  VALUES (p_rifa_id, v_user_id, p_numeros, v_total, 'creditos', v_vendedor_id)
  RETURNING id INTO v_compra_id;

  IF v_vendedor_id IS NOT NULL AND v_comissao > 0 THEN
    v_comissao_valor := v_total * (v_comissao / 100.0);
    UPDATE perfis SET credits = credits + v_comissao_valor
    WHERE id = (SELECT user_id FROM vendedores_rifa WHERE id = v_vendedor_id);
  END IF;

  INSERT INTO cartelas_rifa (numero_rifa_id, compra_id)
  SELECT nr.id, v_compra_id FROM numeros_rifa nr
  WHERE nr.rifa_id = p_rifa_id AND nr.numero = ANY(p_numeros);

  RETURN jsonb_build_object('success', true, 'compra_id', v_compra_id, 'total', v_total);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Vendedor reserva números com preço especial (para revenda física)
CREATE OR REPLACE FUNCTION reservar_numeros_vendedor(
  p_rifa_id UUID,
  p_numeros INTEGER[]
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_vendedor vendedores_rifa%ROWTYPE;
  v_rifa rifas%ROWTYPE;
  v_preco_unit NUMERIC;
  v_desconto NUMERIC;
  v_total NUMERIC;
  v_compra_id UUID;
  v_num INT;
  v_cfg configuracoes%ROWTYPE;
BEGIN
  SELECT * INTO v_vendedor FROM vendedores_rifa WHERE user_id = v_user_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_vendor');
  END IF;

  SELECT * INTO v_rifa FROM rifas WHERE id = p_rifa_id AND status = 'ativa' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'rifa_not_found');
  END IF;

  SELECT * INTO v_cfg FROM configuracoes LIMIT 1;

  IF v_rifa.preco_vendedor IS NOT NULL THEN
    v_preco_unit := v_rifa.preco_vendedor;
    v_desconto := ROUND(100 - (v_rifa.preco_vendedor / v_rifa.custo_por_numero * 100), 2);
  ELSE
    v_desconto := COALESCE(v_vendedor.percentual_desconto, v_cfg.desconto_vendedor_global, 0);
    v_preco_unit := v_rifa.custo_por_numero * (1 - v_desconto / 100.0);
  END IF;

  v_total := array_length(p_numeros, 1) * v_preco_unit;

  IF (SELECT credits FROM perfis WHERE id = v_user_id) < v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  FOR v_num IN SELECT unnest(p_numeros) LOOP
    UPDATE numeros_rifa
    SET status = 'reservado', vendedor_id = v_vendedor.id
    WHERE rifa_id = p_rifa_id AND numero = v_num AND status = 'disponivel';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'numero_indisponivel:%', v_num;
    END IF;
  END LOOP;

  UPDATE perfis SET credits = credits - v_total WHERE id = v_user_id;

  INSERT INTO compras_rifa (rifa_id, vendedor_id, numeros, valor_total, desconto_aplicado, tipo_pagamento)
  VALUES (p_rifa_id, v_vendedor.id, p_numeros, v_total, v_desconto, 'vendedor')
  RETURNING id INTO v_compra_id;

  INSERT INTO cartelas_rifa (numero_rifa_id, compra_id)
  SELECT nr.id, v_compra_id FROM numeros_rifa nr
  WHERE nr.rifa_id = p_rifa_id AND nr.numero = ANY(p_numeros);

  RETURN jsonb_build_object('success', true, 'compra_id', v_compra_id, 'total', v_total, 'preco_unitario', v_preco_unit);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Validar venda física: preenche dados do comprador, libera número para sorteio, credita comissão
CREATE OR REPLACE FUNCTION validar_venda_vendedor(
  p_numero_rifa_id UUID,
  p_nome_comprador TEXT,
  p_telefone_comprador TEXT DEFAULT NULL,
  p_endereco_comprador TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_vendedor_id UUID;
  v_numero numeros_rifa%ROWTYPE;
  v_rifa rifas%ROWTYPE;
  v_cfg configuracoes%ROWTYPE;
  v_comissao NUMERIC;
  v_comissao_valor NUMERIC;
BEGIN
  SELECT id INTO v_vendedor_id FROM vendedores_rifa WHERE user_id = v_user_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_vendor');
  END IF;

  SELECT * INTO v_numero FROM numeros_rifa
  WHERE id = p_numero_rifa_id AND vendedor_id = v_vendedor_id AND status = 'reservado';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'numero_not_found');
  END IF;

  SELECT * INTO v_rifa FROM rifas WHERE id = v_numero.rifa_id;
  SELECT * INTO v_cfg FROM configuracoes LIMIT 1;

  UPDATE numeros_rifa
  SET status = 'vendido',
      nome_comprador = p_nome_comprador,
      telefone_comprador = p_telefone_comprador,
      endereco_comprador = p_endereco_comprador
  WHERE id = p_numero_rifa_id;

  SELECT vr.comissao_percentual INTO v_comissao
  FROM vendedores_rifa vr WHERE vr.id = v_vendedor_id;

  IF v_comissao IS NULL OR v_comissao = 0 THEN
    v_comissao := COALESCE(v_cfg.comissao_vendedor_global, 0);
  END IF;

  IF v_comissao > 0 THEN
    v_comissao_valor := v_rifa.custo_por_numero * (v_comissao / 100.0);
    UPDATE perfis SET credits = credits + v_comissao_valor WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'comissao_creditada', COALESCE(v_comissao_valor, 0));
END;
$$;

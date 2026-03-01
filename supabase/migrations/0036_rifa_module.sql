-- ============================================================
-- MÓDULO DE RIFA ONLINE
-- ============================================================

-- Vendedores (criada antes de numeros_rifa por causa da FK)
CREATE TABLE vendedores_rifa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES perfis(id),
  nome TEXT NOT NULL,
  documento TEXT,
  telefone TEXT,
  percentual_desconto NUMERIC DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clientes (compradores físicos via vendedor)
CREATE TABLE clientes_rifa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  vendedor_id UUID REFERENCES vendedores_rifa(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rifas
CREATE TABLE rifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  regulamento TEXT,
  fotos JSONB DEFAULT '[]',
  foto_capa TEXT,
  premio_descricao TEXT,
  premio_foto TEXT,
  quantidade_numeros INTEGER NOT NULL,
  numero_inicial INTEGER NOT NULL DEFAULT 1,
  custo_por_numero NUMERIC NOT NULL DEFAULT 1,
  data_inicio TIMESTAMPTZ,
  data_encerramento TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','finalizada','cancelada')),
  numero_ganhador INTEGER,
  ganhador_id UUID REFERENCES perfis(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES perfis(id)
);

-- Números da rifa
CREATE TABLE numeros_rifa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rifa_id UUID NOT NULL REFERENCES rifas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','reservado','vendido')),
  comprador_id UUID REFERENCES perfis(id),
  vendedor_id UUID REFERENCES vendedores_rifa(id),
  cliente_rifa_id UUID REFERENCES clientes_rifa(id),
  reservado_ate TIMESTAMPTZ,
  UNIQUE(rifa_id, numero)
);

-- Compras
CREATE TABLE compras_rifa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rifa_id UUID NOT NULL REFERENCES rifas(id),
  comprador_id UUID REFERENCES perfis(id),
  vendedor_id UUID REFERENCES vendedores_rifa(id),
  cliente_rifa_id UUID REFERENCES clientes_rifa(id),
  numeros INTEGER[] NOT NULL,
  valor_total NUMERIC NOT NULL,
  desconto_aplicado NUMERIC DEFAULT 0,
  tipo_pagamento TEXT NOT NULL CHECK (tipo_pagamento IN ('creditos','vendedor')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cartelas (para impressão pelo vendedor)
CREATE TABLE cartelas_rifa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_rifa_id UUID NOT NULL REFERENCES numeros_rifa(id),
  compra_id UUID NOT NULL REFERENCES compras_rifa(id),
  codigo_validacao TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 10)),
  qr_code_data TEXT,
  impresso BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE rifas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos leem rifas" ON rifas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin gerencia rifas" ON rifas FOR ALL USING (is_admin());

ALTER TABLE numeros_rifa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos leem numeros" ON numeros_rifa FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sistema gerencia numeros" ON numeros_rifa FOR ALL USING (is_admin());

ALTER TABLE compras_rifa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario ve proprias compras" ON compras_rifa FOR SELECT USING (auth.uid() = comprador_id OR is_admin());
CREATE POLICY "usuario insere proprias compras" ON compras_rifa FOR INSERT WITH CHECK (auth.uid() = comprador_id OR is_admin());

ALTER TABLE cartelas_rifa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendedor ve proprias cartelas" ON cartelas_rifa FOR SELECT USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM compras_rifa c
    WHERE c.id = cartelas_rifa.compra_id
    AND (
      c.vendedor_id IN (SELECT id FROM vendedores_rifa WHERE user_id = auth.uid())
      OR c.comprador_id = auth.uid()
    )
  )
);

ALTER TABLE vendedores_rifa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gerencia vendedores" ON vendedores_rifa FOR ALL USING (is_admin());
CREATE POLICY "vendedor ve proprio perfil" ON vendedores_rifa FOR SELECT USING (user_id = auth.uid());

ALTER TABLE clientes_rifa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gerencia clientes" ON clientes_rifa FOR ALL USING (is_admin());
CREATE POLICY "vendedor gerencia proprios clientes" ON clientes_rifa FOR ALL USING (
  vendedor_id IN (SELECT id FROM vendedores_rifa WHERE user_id = auth.uid())
);

-- ============================================================
-- RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION popular_numeros_rifa(p_rifa_id UUID, p_inicio INT, p_quantidade INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO numeros_rifa (rifa_id, numero)
  SELECT p_rifa_id, generate_series(p_inicio, p_inicio + p_quantidade - 1);
END;
$$;

CREATE OR REPLACE FUNCTION comprar_numeros_rifa(p_rifa_id UUID, p_numeros INTEGER[])
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_rifa    rifas%ROWTYPE;
  v_total   NUMERIC;
  v_compra_id UUID;
  v_num     INT;
BEGIN
  SELECT * INTO v_rifa FROM rifas WHERE id = p_rifa_id AND status = 'ativa' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'rifa_not_found');
  END IF;

  v_total := array_length(p_numeros, 1) * v_rifa.custo_por_numero;

  IF (SELECT credits FROM perfis WHERE id = v_user_id) < v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  FOR v_num IN SELECT unnest(p_numeros) LOOP
    UPDATE numeros_rifa
    SET status = 'vendido', comprador_id = v_user_id
    WHERE rifa_id = p_rifa_id AND numero = v_num AND status = 'disponivel';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'numero_indisponivel:%', v_num;
    END IF;
  END LOOP;

  UPDATE perfis SET credits = credits - v_total WHERE id = v_user_id;

  INSERT INTO compras_rifa (rifa_id, comprador_id, numeros, valor_total, tipo_pagamento)
  VALUES (p_rifa_id, v_user_id, p_numeros, v_total, 'creditos')
  RETURNING id INTO v_compra_id;

  INSERT INTO cartelas_rifa (numero_rifa_id, compra_id)
  SELECT nr.id, v_compra_id
  FROM numeros_rifa nr
  WHERE nr.rifa_id = p_rifa_id AND nr.numero = ANY(p_numeros);

  RETURN jsonb_build_object('success', true, 'compra_id', v_compra_id, 'total', v_total);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION finalizar_rifa(p_rifa_id UUID, p_numero_ganhador INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role TEXT;
  v_ganhador_id UUID;
BEGIN
  SELECT role INTO v_caller_role FROM perfis WHERE id = auth.uid();
  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT comprador_id INTO v_ganhador_id FROM numeros_rifa
  WHERE rifa_id = p_rifa_id AND numero = p_numero_ganhador;

  UPDATE rifas
  SET status = 'finalizada', numero_ganhador = p_numero_ganhador, ganhador_id = v_ganhador_id
  WHERE id = p_rifa_id;

  RETURN jsonb_build_object('success', true, 'ganhador_id', v_ganhador_id);
END;
$$;

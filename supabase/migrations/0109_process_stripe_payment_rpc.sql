CREATE OR REPLACE FUNCTION public.process_stripe_payment(
    p_session_id text,
    p_user_id uuid,
    p_amount numeric,
    p_payment_type text,
    p_original_amount numeric,
    p_credits_requested numeric,
    p_venda_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_exists boolean;
    v_config_id uuid;
    v_admin_id uuid;
    v_history_id uuid;
    v_venda_bingo record;
    v_venda_rifa record;
    v_comissao_perc numeric;
    v_comissao_valor numeric := 0;
    v_vendedor_user_id uuid;
    v_lucro_admin numeric;
BEGIN
    -- 1. Evita duplicidade (garante que um pagamento não entre 2 vezes)
    SELECT EXISTS(SELECT 1 FROM stripe_payments WHERE stripe_session_id = p_session_id AND status = 'completed') INTO v_exists;
    IF v_exists THEN
        RETURN jsonb_build_object('success', true, 'message', 'already_processed');
    END IF;

    -- 2. Salva o registro bruto do Stripe
    INSERT INTO stripe_payments (stripe_session_id, user_id, amount, status, payment_type)
    VALUES (p_session_id, p_user_id, p_amount, 'completed', p_payment_type);

    -- Pega as configs globais do Admin
    SELECT id, admin_id, comissao_vendedor_global INTO v_config_id, v_admin_id, v_comissao_perc FROM configuracoes LIMIT 1;

    -- ===================================================================================
    -- FLUXO 1: COMPRA DIRETA DE CRÉDITOS (A matemática principal)
    -- ===================================================================================
    IF p_payment_type = 'credits' AND p_user_id IS NOT NULL THEN
        -- 1. Credita jogador (+1.00)
        UPDATE perfis SET credits = COALESCE(credits, 0) + p_credits_requested WHERE id = p_user_id;
        
        -- 2. Credita Admin (+1.00, ignorando as taxas que ficaram no Stripe)
        UPDATE configuracoes SET admin_profit = COALESCE(admin_profit, 0) + p_original_amount WHERE id = v_config_id;
        
        -- 3. Salva Histórico visível para o Admin
        INSERT INTO solicitacoes_credito (player_id, status, credits_requested, credits_granted, amount_paid, receipt_url, notes, resolved_at, repasse_concluido, admin_id)
        VALUES (p_user_id, 'approved', p_credits_requested, p_credits_requested, p_amount, 'STRIPE_' || p_session_id, 'Pagamento automático via Cartão (Stripe).', NOW(), true, v_admin_id)
        RETURNING id INTO v_history_id;

        INSERT INTO mensagens_solicitacao (credit_request_id, sender_id, message)
        VALUES (v_history_id, p_user_id, '✅ Pagamento automático aprovado via Cartão de Crédito.');
        
        RETURN jsonb_build_object('success', true, 'message', 'credits_added');
    END IF;

    -- ===================================================================================
    -- FLUXO 2: VALIDAÇÃO DE CARTELA BINGO (Paga comissão se foi de vendedor)
    -- ===================================================================================
    IF p_payment_type = 'venda_bingo' AND p_venda_id IS NOT NULL THEN
        SELECT * INTO v_venda_bingo FROM vendas_bingo_fisico WHERE id = p_venda_id;
        IF FOUND AND v_venda_bingo.status != 'pago' THEN
            -- Marca como pago
            UPDATE vendas_bingo_fisico SET status = 'pago' WHERE id = p_venda_id;
            -- Adiciona ao Pote da Partida
            UPDATE partidas SET pot = COALESCE(pot, 0) + p_original_amount WHERE id = v_venda_bingo.match_id;

            -- Calcula Comissão do Vendedor (se existir)
            IF v_venda_bingo.vendedor_id IS NOT NULL THEN
                SELECT user_id, comissao_percentual INTO v_vendedor_user_id, v_comissao_perc FROM vendedores_rifa WHERE id = v_venda_bingo.vendedor_id;
                IF v_comissao_perc IS NULL OR v_comissao_perc = 0 THEN
                    SELECT comissao_vendedor_global INTO v_comissao_perc FROM configuracoes LIMIT 1;
                END IF;
                IF v_comissao_perc > 0 THEN
                    v_comissao_valor := p_original_amount * (v_comissao_perc / 100.0);
                    UPDATE perfis SET credits = COALESCE(credits, 0) + v_comissao_valor WHERE id = v_vendedor_user_id;
                END IF;
            END IF;

            -- Resto vai pro caixa do Admin
            v_lucro_admin := p_original_amount - v_comissao_valor;
            UPDATE configuracoes SET admin_profit = COALESCE(admin_profit, 0) + v_lucro_admin WHERE id = v_config_id;
            
            RETURN jsonb_build_object('success', true, 'message', 'bingo_validated');
        END IF;
    END IF;

    -- ===================================================================================
    -- FLUXO 3: VALIDAÇÃO DE RIFA (Paga comissão se foi de vendedor)
    -- ===================================================================================
    IF p_payment_type = 'venda_rifa' AND p_venda_id IS NOT NULL THEN
        SELECT * INTO v_venda_rifa FROM compras_rifa WHERE id = p_venda_id;
        IF FOUND AND v_venda_rifa.status != 'pago' THEN
            UPDATE compras_rifa SET status = 'pago' WHERE id = p_venda_id;

            IF v_venda_rifa.vendedor_id IS NOT NULL OR v_venda_rifa.ref_vendedor_id IS NOT NULL THEN
                SELECT user_id, comissao_percentual INTO v_vendedor_user_id, v_comissao_perc FROM vendedores_rifa WHERE id = COALESCE(v_venda_rifa.vendedor_id, v_venda_rifa.ref_vendedor_id);
                IF v_comissao_perc IS NULL OR v_comissao_perc = 0 THEN
                    SELECT comissao_vendedor_global INTO v_comissao_perc FROM configuracoes LIMIT 1;
                END IF;
                IF v_comissao_perc > 0 THEN
                    v_comissao_valor := p_original_amount * (v_comissao_perc / 100.0);
                    UPDATE perfis SET credits = COALESCE(credits, 0) + v_comissao_valor WHERE id = v_vendedor_user_id;
                END IF;
            END IF;

            v_lucro_admin := p_original_amount - v_comissao_valor;
            UPDATE configuracoes SET admin_profit = COALESCE(admin_profit, 0) + v_lucro_admin WHERE id = v_config_id;

            RETURN jsonb_build_object('success', true, 'message', 'rifa_validated');
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'unhandled_type_or_already_paid');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
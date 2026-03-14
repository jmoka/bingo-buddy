import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'npm:stripe@16.10.0'

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('configuracoes')
    .select('stripe_secret_key, stripe_webhook_secret')
    .eq('singleton', true)
    .single();

  if (settingsError || !settings?.stripe_secret_key || !settings?.stripe_webhook_secret) {
      console.error("[stripe-webhook] Erro: Chaves do Stripe não configuradas.");
      return new Response('Config Error', { status: 500 });
  }

  const stripe = new Stripe(settings.stripe_secret_key.trim(), {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
      console.error("[stripe-webhook] Erro: Faltando assinatura do Stripe.");
      return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text()
    
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      settings.stripe_webhook_secret.trim()
    )

    console.log(`[stripe-webhook] Evento Recebido: ${event.type}`);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object
      
      if (session.payment_status === 'paid') {
        const userId = session.client_reference_id || session.metadata?.user_id || 'anonymous';
        const paymentType = session.metadata?.payment_type;
        const amount = session.amount_total ? session.amount_total / 100 : 0;

        console.log(`[stripe-webhook] Processando - Usuário: ${userId} | Valor: R$ ${amount} | Tipo: ${paymentType}`);

        // 1. Evita processar a mesma compra 2 vezes
        const { data: existing } = await supabaseAdmin
          .from('stripe_payments')
          .select('status')
          .eq('stripe_session_id', session.id)
          .maybeSingle();

        if (existing?.status === 'completed') {
            console.log(`[stripe-webhook] Sessão ${session.id} já processada. Ignorando.`);
            return new Response(JSON.stringify({ received: true }), { status: 200 });
        }

        // 2. Registra a transação de cartão na tabela
        await supabaseAdmin.from('stripe_payments').insert({ 
            stripe_session_id: session.id,
            user_id: userId === 'anonymous' ? null : userId,
            amount: amount,
            status: 'completed',
            payment_type: paymentType || 'unknown'
        });

        // 3. SE FOR COMPRA DE CRÉDITOS NA CONTA
        if (paymentType === 'credits' && userId !== 'anonymous') {
          const creditsToGrant = Number(session.metadata?.credits_requested || amount);
          await supabaseAdmin.rpc('increment_player_credits', { p_player_id: userId, p_amount: creditsToGrant });
          await supabaseAdmin.rpc('increment_admin_profit', { amount: amount });

          const { data: historyData } = await supabaseAdmin.from('solicitacoes_credito').insert({
            player_id: userId, status: 'approved', credits_requested: creditsToGrant, credits_granted: creditsToGrant,
            amount_paid: amount, receipt_url: `STRIPE_${session.id}`, notes: 'Pagamento automático via Cartão de Crédito (Stripe).', resolved_at: new Date().toISOString()
          }).select('id').single();

          if (historyData) {
            await supabaseAdmin.from('mensagens_solicitacao').insert({
              credit_request_id: historyData.id, sender_id: userId, message: `✅ Pagamento automático de R$ ${amount.toFixed(2)} aprovado via Cartão de Crédito.`
            });
          }
        } 
        
        // 4. SE FOR PAGAMENTO DE UMA CARTELA FÍSICA (PagarCartela)
        else if (paymentType === 'venda_bingo' || paymentType === 'venda_rifa') {
            const vendaId = session.metadata?.venda_id;
            console.log(`[stripe-webhook] Aprovando venda/cartela ID: ${vendaId}`);
            
            if (vendaId && paymentType === 'venda_bingo') {
                const { data: venda } = await supabaseAdmin.from('vendas_bingo_fisico').select('*').eq('id', vendaId).single();
                if (venda && venda.status !== 'pago') {
                    const { data: vendedor } = await supabaseAdmin.from('vendedores_rifa').select('*').eq('id', venda.vendedor_id).single();
                    const { data: cfg } = await supabaseAdmin.from('configuracoes').select('*').limit(1).single();
                    
                    let precoTotal = Number(venda.valor_pago);
                    const desconto = Number(venda.desconto_aplicado || 0);
                    if (desconto < 100 && desconto > 0) precoTotal = precoTotal / (1 - (desconto / 100.0));

                    // Ativa a cartela
                    await supabaseAdmin.from('vendas_bingo_fisico').update({ status: 'pago' }).eq('id', vendaId);
                    
                    // Alimenta o pote da partida
                    const { data: match } = await supabaseAdmin.from('partidas').select('pot').eq('id', venda.match_id).single();
                    if (match) await supabaseAdmin.from('partidas').update({ pot: Number(match.pot || 0) + precoTotal }).eq('id', venda.match_id);

                    // Paga comissão do vendedor (e repassa o resto do dinheiro para o caixa do admin)
                    await supabaseAdmin.rpc('increment_admin_profit', { amount: amount });
                    const comissaoPerc = Number(vendedor?.comissao_percentual || cfg?.comissao_vendedor_global || 0);
                    if (comissaoPerc > 0 && vendedor?.user_id) {
                        const comissaoValor = precoTotal * (comissaoPerc / 100.0);
                        await supabaseAdmin.rpc('increment_player_credits', { p_player_id: vendedor.user_id, p_amount: comissaoValor });
                        await supabaseAdmin.rpc('increment_admin_profit', { amount: -comissaoValor });
                    }
                    console.log("[stripe-webhook] Venda Bingo ativada com sucesso!");
                }
            } else if (vendaId && paymentType === 'venda_rifa') {
                const { data: compra } = await supabaseAdmin.from('compras_rifa').select('*').eq('id', vendaId).single();
                if (compra && compra.status !== 'pago') {
                    // Ativa a cartela da rifa
                    await supabaseAdmin.from('compras_rifa').update({ status: 'pago' }).eq('id', vendaId);
                    
                    const { data: vendedor } = await supabaseAdmin.from('vendedores_rifa').select('*').eq('id', compra.vendedor_id).single();
                    const { data: cfg } = await supabaseAdmin.from('configuracoes').select('*').limit(1).single();

                    let precoTotal = Number(compra.valor_total);
                    const desconto = Number(compra.desconto_aplicado || 0);
                    if (desconto < 100 && desconto > 0) precoTotal = precoTotal / (1 - (desconto / 100.0));

                    await supabaseAdmin.rpc('increment_admin_profit', { amount: amount });

                    // Paga a comissão do vendedor da Rifa (se tiver)
                    const comissaoPerc = Number(vendedor?.comissao_percentual || cfg?.comissao_vendedor_global || 0);
                    if (comissaoPerc > 0 && vendedor?.user_id) {
                        const comissaoValor = precoTotal * (comissaoPerc / 100.0);
                        await supabaseAdmin.rpc('increment_player_credits', { p_player_id: vendedor.user_id, p_amount: comissaoValor });
                        await supabaseAdmin.rpc('increment_admin_profit', { amount: -comissaoValor });
                    }
                    console.log("[stripe-webhook] Venda Rifa ativada com sucesso!");
                }
            }
        }
      } 
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err: any) {
    console.error(`[stripe-webhook] 💥 FATAL ERROR: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
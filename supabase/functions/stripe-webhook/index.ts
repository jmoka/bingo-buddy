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
    
    // Constrói o evento assíncrono para validação da assinatura
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      settings.stripe_webhook_secret.trim()
    )

    console.log(`[stripe-webhook] Evento Recebido: ${event.type}`);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object
      
      if (session.payment_status === 'paid') {
        // Pega os dados com segurança
        const userId = session.client_reference_id || session.metadata?.user_id;
        const paymentType = session.metadata?.payment_type;
        const amount = session.amount_total ? session.amount_total / 100 : 0;
        const creditsToGrant = Number(session.metadata?.credits_requested || amount);

        console.log(`[stripe-webhook] Processando - Usuário: ${userId} | Valor: R$ ${amount} | Créditos: ${creditsToGrant}`);

        if (!userId) {
            console.error("[stripe-webhook] FATAL: userId não foi encontrado na sessão.");
            return new Response('Missing userId', { status: 400 });
        }

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

        // 2. Registra a transação de cartão (Vai aparecer na sua aba Cartões)
        console.log("[stripe-webhook] Inserindo registro na tabela stripe_payments...");
        const { error: insertError } = await supabaseAdmin
          .from('stripe_payments')
          .insert({ 
              stripe_session_id: session.id,
              user_id: userId,
              amount: amount,
              status: 'completed',
              payment_type: paymentType || 'unknown'
          });

        if (insertError) {
            console.error("[stripe-webhook] ERRO ao inserir em stripe_payments:", insertError);
        }

        if (paymentType === 'credits') {
          console.log("[stripe-webhook] Iniciando liberação dos créditos e saldo do admin...");

          // 3. Libera os créditos pro jogador
          const { error: creditError } = await supabaseAdmin.rpc('increment_player_credits', {
            p_player_id: userId,
            p_amount: creditsToGrant
          });
          if (creditError) console.error("[stripe-webhook] ERRO ao creditar jogador:", creditError);

          // 4. Adiciona o valor pago no Caixa do Admin
          const { error: profitError } = await supabaseAdmin.rpc('increment_admin_profit', {
            amount: amount
          });
          if (profitError) console.error("[stripe-webhook] ERRO ao subir caixa do Admin:", profitError);

          // 5. Registra no histórico de créditos para o jogador ver
          const { error: historyError } = await supabaseAdmin.from('solicitacoes_credito').insert({
            player_id: userId,
            status: 'approved',
            credits_requested: creditsToGrant,
            credits_granted: creditsToGrant,
            amount_paid: amount,
            receipt_url: `STRIPE_${session.id}`,
            notes: 'Pagamento automático via Cartão de Crédito (Stripe).',
            resolved_at: new Date().toISOString()
          });
          if (historyError) console.error("[stripe-webhook] ERRO ao registrar histórico:", historyError);

          console.log("[stripe-webhook] Processo de créditos finalizado com sucesso!");
        }
      } else {
         console.log(`[stripe-webhook] Ignorado: payment_status está como '${session.payment_status}'`);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err: any) {
    console.error(`[stripe-webhook] 💥 FATAL ERROR: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
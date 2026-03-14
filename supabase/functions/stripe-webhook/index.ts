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
      return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text()
    
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      settings.stripe_webhook_secret.trim()
    )

    console.log(`[stripe-webhook] Evento: ${event.type}`);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object
      
      if (session.payment_status === 'paid') {
        const userId = session.client_reference_id
        const paymentType = session.metadata?.payment_type
        const amount = session.amount_total ? session.amount_total / 100 : 0

        const { data: existing } = await supabaseAdmin
          .from('stripe_payments')
          .select('status')
          .eq('stripe_session_id', session.id)
          .maybeSingle();

        if (existing?.status !== 'completed' && userId) {
          await supabaseAdmin
            .from('stripe_payments')
            .upsert({ 
                stripe_session_id: session.id,
                user_id: userId,
                amount: amount,
                status: 'completed',
                payment_type: paymentType || 'unknown',
                updated_at: new Date().toISOString() 
            });

          if (paymentType === 'credits') {
            const creditsToGrant = Number(session.metadata?.credits_requested || amount);
            
            console.log(`[stripe-webhook] Liberando ${creditsToGrant} créditos para ${userId}`);

            // 1. Libera os créditos pro jogador
            await supabaseAdmin.rpc('increment_player_credits', {
              p_player_id: userId,
              p_amount: creditsToGrant
            });

            // 2. Adiciona o valor pago no Caixa do Admin
            await supabaseAdmin.rpc('increment_admin_profit', {
              amount: amount
            });

            // 3. Registra no histórico de créditos e Puxa o ID gerado
            const { data: historyData, error: historyError } = await supabaseAdmin.from('solicitacoes_credito').insert({
              player_id: userId,
              status: 'approved',
              credits_requested: creditsToGrant,
              credits_granted: creditsToGrant,
              amount_paid: amount,
              receipt_url: `STRIPE_${session.id}`,
              notes: 'Pagamento aprovado automaticamente via Cartão de Crédito (Stripe).',
              resolved_at: new Date().toISOString()
            }).select('id').single();

            if (historyError) {
              console.error("[stripe-webhook] ERRO ao registrar histórico:", historyError);
            } else if (historyData) {
              // 4. Salva a mensagem no chat para que não fique vazia
              await supabaseAdmin.from('mensagens_solicitacao').insert({
                credit_request_id: historyData.id,
                sender_id: userId,
                message: `✅ Pagamento automático de R$ ${amount.toFixed(2)} aprovado via Cartão de Crédito (Stripe).\n\n💳 Os ${creditsToGrant} créditos já foram liberados e estão disponíveis na sua conta para jogar.`
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err: any) {
    console.error(`💥 FATAL ERROR in stripe-webhook: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
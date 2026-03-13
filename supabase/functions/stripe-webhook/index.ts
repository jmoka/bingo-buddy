import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'https://esm.sh/stripe@14.16.0?target=deno'

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('configuracoes')
    .select('stripe_secret_key, stripe_webhook_secret')
    .single();

  if (settingsError || !settings?.stripe_secret_key || !settings?.stripe_webhook_secret) {
      console.error("[webhook] Erro: Chaves do Stripe não configuradas no banco.");
      return new Response('Config Error', { status: 500 });
  }

  const stripe = new Stripe(settings.stripe_secret_key, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('No signature', { status: 400 })

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      settings.stripe_webhook_secret
    )

    // Processamos tanto o fechamento da sessão quanto a confirmação assíncrona (PIX)
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object
      
      // Evita processar duas vezes se ambos os eventos dispararem
      if (session.payment_status !== 'paid') {
          console.log(`[webhook] Sessão ${session.id} ainda não está paga. Aguardando confirmação.`);
          return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const userId = session.client_reference_id
      const paymentType = session.metadata?.payment_type
      const amount = session.amount_total / 100

      // Verifica se já processamos este pagamento para evitar duplicidade
      const { data: existingPayment } = await supabaseAdmin
        .from('stripe_payments')
        .select('status')
        .eq('stripe_session_id', session.id)
        .single();

      if (existingPayment?.status === 'completed') {
          console.log(`[webhook] Pagamento ${session.id} já foi processado anteriormente.`);
          return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      console.log(`[webhook] Processando pagamento confirmado: ${session.id} para usuário ${userId}`);

      await supabaseAdmin
        .from('stripe_payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('stripe_session_id', session.id);

      if (paymentType === 'credits') {
        const creditsToGrant = Number(session.metadata?.credits_requested || amount);
        
        await supabaseAdmin.rpc('increment_player_credits', {
          p_player_id: userId,
          p_amount: creditsToGrant
        });

        await supabaseAdmin.from('solicitacoes_credito').insert({
          player_id: userId,
          status: 'approved',
          credits_requested: creditsToGrant,
          credits_granted: creditsToGrant,
          amount_paid: amount,
          receipt_url: `STRIPE_${session.id}`,
          notes: 'Pagamento automático via Stripe.',
          resolved_at: new Date().toISOString()
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error(`[webhook] Erro: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
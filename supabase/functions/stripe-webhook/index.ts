import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'https://esm.sh/stripe@14.16.0'

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('configuracoes')
    .select('stripe_secret_key, stripe_webhook_secret')
    .eq('singleton', true)
    .single();

  if (settingsError || !settings?.stripe_secret_key || !settings?.stripe_webhook_secret) {
      console.error("[stripe-webhook] Erro: Configurações ausentes.");
      return new Response('Config Error', { status: 500 });
  }

  const stripe = new Stripe(settings.stripe_secret_key, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('No signature', { status: 400 });

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      settings.stripe_webhook_secret
    )

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object
      
      if (session.payment_status === 'paid') {
        const userId = session.client_reference_id
        const paymentType = session.metadata?.payment_type
        const amount = session.amount_total / 100

        const { data: existing } = await supabaseAdmin
          .from('stripe_payments')
          .select('status')
          .eq('stripe_session_id', session.id)
          .maybeSingle();

        if (existing?.status !== 'completed') {
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
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error(`[stripe-webhook] Erro: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
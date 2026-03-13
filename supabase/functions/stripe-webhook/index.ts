import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'https://esm.sh/stripe@14.16.0?target=deno'

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
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
      Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.client_reference_id
      const paymentType = session.metadata?.payment_type
      const amount = session.amount_total / 100

      console.log(`[webhook] Pagamento confirmado: ${session.id} para usuário ${userId}`);

      // 1. Atualiza o status na tabela stripe_payments
      await supabaseAdmin
        .from('stripe_payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('stripe_session_id', session.id);

      // 2. Se for compra de créditos, adiciona ao saldo
      if (paymentType === 'credits') {
        const creditsToGrant = Number(session.metadata?.credits_requested || amount);
        
        // Incrementa créditos
        await supabaseAdmin.rpc('increment_player_credits', {
          p_player_id: userId,
          p_amount: creditsToGrant
        });

        // Registra na tabela de solicitações como aprovado automaticamente
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
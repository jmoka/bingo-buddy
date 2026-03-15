import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'npm:stripe@16.10.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('configuracoes')
    .select('stripe_secret_key, stripe_webhook_secret')
    .limit(1)
    .maybeSingle();

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

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object
      
      if (session.payment_status === 'paid') {
        const userId = session.client_reference_id || session.metadata?.user_id;
        const paymentType = session.metadata?.payment_type;
        const amountPaidByCustomer = session.amount_total ? session.amount_total / 100 : 0;
        const originalAmount = session.metadata?.original_amount ? Number(session.metadata.original_amount) : amountPaidByCustomer;
        const creditsRequested = Number(session.metadata?.credits_requested || originalAmount);
        const vendaId = session.metadata?.venda_id || null;

        // Chama a função matemática blindada que acabamos de criar no banco!
        const { data, error } = await supabaseAdmin.rpc('process_stripe_payment', {
            p_session_id: session.id,
            p_user_id: userId === 'anonymous' ? null : userId,
            p_amount: amountPaidByCustomer,
            p_payment_type: paymentType || 'unknown',
            p_original_amount: originalAmount,
            p_credits_requested: creditsRequested,
            p_venda_id: vendaId
        });

        if (error) {
            console.error("[stripe-webhook] Erro no banco de dados:", error);
        } else {
            console.log(`[stripe-webhook] Sucesso: ${JSON.stringify(data)}`);
        }
      } 
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders })
  } catch (err: any) {
    console.error(`[stripe-webhook] Erro: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400, headers: corsHeaders })
  }
})
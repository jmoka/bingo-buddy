import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'npm:stripe@16.10.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("[stripe-webhook] Edge Function Inicializada com sucesso.");

serve(async (req) => {
  console.log(`[stripe-webhook] 🟢 INÍCIO DA REQUISIÇÃO: ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    console.log("[stripe-webhook] Respondendo OPTIONS preflight");
    return new Response(null, { headers: corsHeaders })
  }

  const signature = req.headers.get('stripe-signature')
  console.log(`[stripe-webhook] Assinatura do Stripe presente? ${!!signature}`);

  if (!signature) {
      console.error("[stripe-webhook] Erro: Faltando assinatura do Stripe.");
      return new Response('No signature', { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  console.log("[stripe-webhook] Buscando configurações no banco...");
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('configuracoes')
    .select('id, stripe_secret_key, stripe_webhook_secret, comissao_vendedor_global, admin_profit')
    .limit(1)
    .maybeSingle();

  if (settingsError || !settings?.stripe_secret_key || !settings?.stripe_webhook_secret) {
      console.error("[stripe-webhook] Erro: Chaves do Stripe não configuradas no banco.", settingsError);
      return new Response('Config Error', { status: 500 });
  }

  const stripe = new Stripe(settings.stripe_secret_key.trim(), {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  try {
    const body = await req.text()
    console.log("[stripe-webhook] Corpo da requisição lido com sucesso. Construindo evento...");
    
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      settings.stripe_webhook_secret.trim()
    )

    console.log(`[stripe-webhook] 🚀 EVENTO VALIDADO: ${event.type}`);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object
      
      if (session.payment_status === 'paid') {
        const userId = session.client_reference_id || session.metadata?.user_id || 'anonymous';
        const paymentType = session.metadata?.payment_type;
        const amountPaidByCustomer = session.amount_total ? session.amount_total / 100 : 0;
        const originalAmount = session.metadata?.original_amount ? Number(session.metadata.original_amount) : amountPaidByCustomer;

        console.log(`[stripe-webhook] Processando pagamento! Usuário: ${userId} | Valor Líquido: R$ ${originalAmount} | Tipo: ${paymentType}`);

        const { data: existing } = await supabaseAdmin
          .from('stripe_payments')
          .select('status')
          .eq('stripe_session_id', session.id)
          .maybeSingle();

        if (existing?.status === 'completed') {
            console.log(`[stripe-webhook] ⚠️ Sessão já processada anteriormente. Ignorando.`);
            return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });
        }

        console.log("[stripe-webhook] Gravando transação em stripe_payments...");
        await supabaseAdmin.from('stripe_payments').insert({ 
            stripe_session_id: session.id,
            user_id: userId === 'anonymous' ? null : userId,
            amount: amountPaidByCustomer,
            status: 'completed',
            payment_type: paymentType || 'unknown'
        });

        if (paymentType === 'credits' && userId !== 'anonymous') {
          console.log("[stripe-webhook] Fluxo: Compra de Créditos.");
          const creditsToGrant = Number(session.metadata?.credits_requested || originalAmount);
          
          await supabaseAdmin.rpc('increment_player_credits', { p_player_id: userId, p_amount: creditsToGrant });
          await supabaseAdmin.rpc('increment_admin_profit', { amount: originalAmount });

          const { data: historyData } = await supabaseAdmin.from('solicitacoes_credito').insert({
            player_id: userId, status: 'approved', credits_requested: creditsToGrant, credits_granted: creditsToGrant,
            amount_paid: amountPaidByCustomer, receipt_url: `STRIPE_${session.id}`, notes: 'Pagamento automático via Cartão de Crédito (Stripe).', resolved_at: new Date().toISOString(), repasse_concluido: true
          }).select('id').single();

          if (historyData) {
            await supabaseAdmin.from('mensagens_solicitacao').insert({
              credit_request_id: historyData.id, sender_id: userId, message: `✅ Pagamento automático aprovado via Cartão de Crédito.`
            });
          }
          console.log(`[stripe-webhook] ✅ Créditos adicionados com sucesso! (+${creditsToGrant} para ${userId})`);
        } 
      } 
    }

    console.log("[stripe-webhook] ✅ Webhook finalizado com sucesso.");
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders })
  } catch (err: any) {
    console.error(`[stripe-webhook] 💥 FATAL ERROR: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400, headers: corsHeaders })
  }
})
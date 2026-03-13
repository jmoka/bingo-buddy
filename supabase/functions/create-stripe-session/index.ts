import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'https://esm.sh/stripe@14.16.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    console.log("[create-stripe-session] Iniciando v2 (Sem PIX manual)");
    
    const { amount, type, metadata = {} } = await req.json()
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: settings } = await supabaseAdmin
      .from('configuracoes')
      .select('stripe_secret_key')
      .single();

    if (!settings?.stripe_secret_key) {
        throw new Error("Chave do Stripe não configurada no Admin.");
    }

    const stripe = new Stripe(settings.stripe_secret_key.trim(), {
      apiVersion: '2023-10-16',
    })

    const authHeader = req.headers.get('Authorization')
    const userSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader! } } }
    )
    const { data: { user } } = await userSupabaseClient.auth.getUser()
    
    if (!user) throw new Error("Usuário não autenticado.");

    // Criando a sessão. 
    // Removi 'pix' e usei 'automatic_payment_methods'
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: type === 'credits' ? 'Créditos Bingo Show' : 'Cartela Bingo Show',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Isso permite que o Stripe mostre o que estiver ativo no seu painel
      automatic_payment_methods: {
        enabled: true,
      },
      success_url: `${req.headers.get('origin')}/?payment=success`,
      cancel_url: `${req.headers.get('origin')}/?payment=cancel`,
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        ...metadata,
        user_id: user.id,
        payment_type: type
      },
    })

    console.log(`[create-stripe-session] Sessão criada: ${session.id}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[create-stripe-session] Erro fatal:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
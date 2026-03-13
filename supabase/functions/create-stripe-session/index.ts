import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'https://esm.sh/stripe@16.5.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { amount, type, metadata = {} } = await req.json()
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('configuracoes')
      .select('stripe_secret_key')
      .eq('singleton', true)
      .single();

    if (settingsError || !settings?.stripe_secret_key) {
        throw new Error("Chave do Stripe não configurada no Admin.");
    }

    const stripe = new Stripe(settings.stripe_secret_key.trim(), {
      apiVersion: '2024-06-20',
    })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Não autorizado.");

    const userSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser()
    
    if (userError || !user) throw new Error("Usuário não autenticado.");

    console.log(`[create-stripe-session] Criando checkout para ${user.email} - R$ ${amount}`);

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

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('💥 FATAL ERROR in create-stripe-session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
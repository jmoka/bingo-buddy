import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'https://esm.sh/stripe@14.16.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { amount, type, metadata = {} } = await req.json()
    
    console.log("[create-stripe-session] Iniciando criação de sessão", { amount, type });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca a chave secreta no banco de dados
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('configuracoes')
      .select('stripe_secret_key')
      .single();

    if (settingsError || !settings?.stripe_secret_key) {
        console.error("[create-stripe-session] Erro: Stripe Secret Key não encontrada no banco.");
        throw new Error("Stripe Secret Key não configurada no painel administrativo.");
    }

    const stripe = new Stripe(settings.stripe_secret_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Token de autorização ausente");

    const userSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser()
    if (userError || !user) {
        console.error("[create-stripe-session] Erro de autenticação", userError);
        throw new Error("Usuário não autenticado ou token inválido");
    }

    console.log(`[create-stripe-session] Criando checkout para ${user.email}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: type === 'credits' ? 'Créditos Bingo Show' : 'Cartela Bingo Show',
            },
            unit_amount: Math.round(amount * 100), // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
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

    // Registra a sessão no banco para controle
    const { error: dbError } = await supabaseAdmin.from('stripe_payments').insert({
      user_id: user.id,
      stripe_session_id: session.id,
      amount: amount,
      payment_type: type,
      metadata: metadata
    })

    if (dbError) {
        console.warn("[create-stripe-session] Aviso: Falha ao registrar sessão no banco, mas o checkout foi criado.", dbError);
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[create-stripe-session] Erro fatal:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
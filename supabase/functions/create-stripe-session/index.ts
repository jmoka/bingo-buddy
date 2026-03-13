import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'https://esm.sh/stripe@14.16.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Lida com requisições de pre-flight (CORS)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { amount, type, metadata = {} } = await req.json()
    
    if (!amount || amount <= 0) {
        throw new Error("Valor inválido para pagamento.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca as configurações do Stripe no banco de dados
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('configuracoes')
      .select('stripe_secret_key')
      .eq('singleton', true)
      .single();

    if (settingsError || !settings?.stripe_secret_key) {
        console.error("[create-stripe-session] Erro: Chave secreta não encontrada no banco.");
        return new Response(JSON.stringify({ error: "Configuração do Stripe incompleta no painel administrativo." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }

    const secretKey = settings.stripe_secret_key.trim();

    if (!secretKey.startsWith('sk_')) {
        return new Response(JSON.stringify({ error: "A chave configurada no painel não é uma Secret Key válida do Stripe (deve começar com sk_)." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Autenticação do usuário que chamou a função
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Não autorizado: Token ausente.");

    const userSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser()
    if (userError || !user) throw new Error("Usuário inválido ou sessão expirada.");

    console.log(`[create-stripe-session] Criando checkout para ${user.email} no valor de R$ ${amount}`);

    // Cria a sessão de checkout no Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: type === 'credits' ? 'Créditos Bingo Show' : 'Cartela Bingo Show',
              description: type === 'credits' ? `Recarga de ${metadata.credits_requested || amount} créditos` : 'Participação em partida de Bingo',
            },
            unit_amount: Math.round(amount * 100), // Converte para centavos
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

    // Registra a tentativa de pagamento no banco de dados
    await supabaseAdmin.from('stripe_payments').insert({
      user_id: user.id,
      stripe_session_id: session.id,
      amount: amount,
      payment_type: type,
      metadata: metadata,
      status: 'pending'
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[create-stripe-session] Erro fatal:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Retornamos 400 para que o erro apareça no toast do frontend
    })
  }
})
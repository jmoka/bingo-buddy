import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import Stripe from 'npm:stripe@16.10.0'

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
    let user = null;

    // Tenta pegar o usuário se ele estiver logado, mas não bloqueia se for anônimo (para compras de cartela física)
    if (authHeader && authHeader !== 'Bearer null' && authHeader !== 'null') {
      try {
        const userSupabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )
        const { data } = await userSupabaseClient.auth.getUser()
        if (data?.user) user = data.user;
      } catch(e) {
          console.error("Auth pass-through falhou", e);
      }
    }
    
    if (!user && type === 'credits') {
        throw new Error("Usuário não autenticado para compra de créditos.");
    }

    console.log(`[create-stripe-session] Criando checkout - Tipo: ${type} | R$ ${amount}`);

    const origin = req.headers.get('origin') || 'http://localhost:5173';
    let success_url = `${origin}/?payment=success`;
    let cancel_url = `${origin}/?payment=cancel`;
    
    // Se for validação de cartela, volta pra mesma tela mostrando que deu certo
    if ((type === 'venda_bingo' || type === 'venda_rifa') && metadata.codigo) {
        success_url = `${origin}/pagar-cartela?codigo=${metadata.codigo}&payment=success`;
        cancel_url = `${origin}/pagar-cartela?codigo=${metadata.codigo}`;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: type === 'credits' ? 'Créditos Bingo Show' : 'Validação de Cartela (Bingo Show)',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url,
      cancel_url,
      customer_email: user?.email || undefined,
      client_reference_id: user?.id || 'anonymous',
      metadata: {
        ...metadata,
        user_id: user?.id || 'anonymous',
        payment_type: type
      },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('💥 FATAL ERROR in create-stripe-session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
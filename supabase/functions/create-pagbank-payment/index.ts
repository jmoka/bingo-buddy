import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // payment_method: 'pix' ou 'CREDIT_CARD'
    const { amount, type, metadata, admin_id, payment_method = 'pix' } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let configQuery = supabaseAdmin.from('configuracoes').select('*');
    if (admin_id) {
        configQuery = configQuery.eq('admin_id', admin_id);
    }
    const { data: config, error: configError } = await configQuery.limit(1).single();

    if (configError || !config) throw new Error("Configurações não encontradas no sistema.");

    const isProd = config.pagbank_env === 'producao';
    const token = (isProd ? config.pagbank_token_producao : config.pagbank_token_sandbox)?.trim();
    const apiUrl = isProd ? 'https://api.pagseguro.com' : 'https://sandbox.api.pagseguro.com';

    if (!token) throw new Error(`Token do PagBank não configurado para o ambiente: ${config.pagbank_env}`);

    const authHeader = req.headers.get('Authorization');
    let user_id = null;
    let customerName = 'Cliente Bingo Show';
    let customerEmail = 'cliente@bingoshow.com';
    let customerTaxId = '12345678909'; 
    let redirectUrl = metadata?.origin || 'http://localhost:5173';

    if (authHeader && authHeader !== 'Bearer null' && authHeader !== 'null') {
        const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
            user_id = user.id;
            customerEmail = user.email || customerEmail;
            const { data: profile } = await supabaseAdmin.from('perfis').select('full_name, cpf').eq('id', user.id).single();
            if (profile) {
                customerName = profile.full_name || customerName;
                if (profile.cpf) {
                  const cleanCpf = profile.cpf.replace(/\D/g, '');
                  if (cleanCpf.length === 11 || cleanCpf.length === 14) customerTaxId = cleanCpf;
                }
            }
        }
    }

    if (metadata?.cliente_nome) customerName = metadata.cliente_nome;
    if (metadata?.customer_cpf) {
        customerTaxId = metadata.customer_cpf.replace(/\D/g, '');
        if (user_id && (customerTaxId.length === 11 || customerTaxId.length === 14)) {
            supabaseAdmin.from('perfis').update({ cpf: customerTaxId }).eq('id', user_id).then(({error}) => { if(error) console.error("Erro update CPF:", error) });
        }
    }

    if (!customerTaxId || (customerTaxId.length !== 11 && customerTaxId.length !== 14)) {
        throw new Error("CPF_REQUIRED: É obrigatório informar um CPF válido.");
    }

    // CÁLCULO DE TAXAS (Lado do Servidor para Segurança)
    let finalAmount = Number(amount);
    if (config.pagbank_pass_fees_to_customer) {
        const feePerc = payment_method === 'pix' ? Number(config.pagbank_pix_fee_percentage || 0) : Number(config.pagbank_card_fee_percentage || 0);
        const feeFixed = payment_method === 'pix' ? Number(config.pagbank_pix_fee_fixed || 0) : Number(config.pagbank_card_fee_fixed || 0);
        
        finalAmount = (finalAmount + feeFixed) / (1 - (feePerc / 100));
        finalAmount = Math.ceil(finalAmount * 100) / 100;
    }

    const valorEmCentavos = Math.round(finalAmount * 100);
    const reference_id = `${type.toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const itemName = type === 'credits' ? 'Créditos Bingo Show' : 'Bilhete Bingo Show';

    // REGISTRO DE COMPRADOR (Venda Cartela Física)
    try {
      if (type === 'venda_bingo' && metadata?.venda_id) {
          await supabaseAdmin.from('vendas_bingo_fisico').update({ nome_comprador: customerName, telefone_comprador: metadata?.cliente_telefone || null }).eq('id', metadata.venda_id);
      } else if (type === 'venda_rifa' && metadata?.venda_id) {
          const { data: cartela } = await supabaseAdmin.from('cartelas_rifa').select('numero_rifa_id').eq('compra_id', metadata.venda_id).maybeSingle();
          if (cartela?.numero_rifa_id) await supabaseAdmin.from('numeros_rifa').update({ nome_comprador: customerName, telefone_comprador: metadata?.cliente_telefone || null }).eq('id', cartela.numero_rifa_id);
      }
    } catch (err) { console.error("Erro pre-salvar comprador:", err); }

    let responseData;
    let pagbank_order_id = '';
    let qr_code = null;
    let qr_code_text = null;
    let checkout_link = null;

    // FLUXO DE CHECKOUT (CARTÃO DE CRÉDITO)
    if (payment_method === 'CREDIT_CARD') {
        // Redirecionamento Pós-Pagamento
        let success_url = `${redirectUrl}/?payment=success`;
        let cancel_url = `${redirectUrl}/?payment=cancel`;
        if ((type === 'venda_bingo' || type === 'venda_rifa') && metadata.codigo) {
            success_url = `${redirectUrl}/pagar-cartela?codigo=${metadata.codigo}&payment=success`;
            cancel_url = `${redirectUrl}/pagar-cartela?codigo=${metadata.codigo}`;
        }

        const checkoutPayload = {
            reference_id: reference_id,
            expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            customer: { name: customerName, email: customerEmail, tax_id: customerTaxId },
            items: [{ reference_id: `ITEM_${reference_id}`, name: itemName, quantity: 1, unit_amount: valorEmCentavos }],
            payment_methods: [{"type": "CREDIT_CARD"}],
            notification_urls: [`${Deno.env.get('SUPABASE_URL')}/functions/v1/pagbank-webhook`],
            redirect_url: success_url
        };

        const response = await fetch(`${apiUrl}/checkouts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'x-api-version': '4.0' },
            body: JSON.stringify(checkoutPayload)
        });

        responseData = await response.json();
        if (!response.ok) throw new Error(responseData.error_messages?.[0]?.description || "Erro ao gerar Checkout PagBank.");
        
        pagbank_order_id = responseData.id;
        checkout_link = responseData.links?.find((l: any) => l.rel === 'PAY')?.href;
        
        if (!checkout_link) throw new Error("Link de Checkout não retornado pelo PagBank.");
    } 
    // FLUXO DE ORDERS (PIX AUTOMÁTICO)
    else {
        const orderPayload = {
          reference_id: reference_id,
          customer: { name: customerName, email: customerEmail, tax_id: customerTaxId },
          items: [{ name: itemName, quantity: 1, unit_amount: valorEmCentavos }],
          qr_codes: [{ amount: { value: valorEmCentavos }, expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }],
          notification_urls: [`${Deno.env.get('SUPABASE_URL')}/functions/v1/pagbank-webhook`]
        };

        const response = await fetch(`${apiUrl}/orders`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'x-api-version': '4.0' },
            body: JSON.stringify(orderPayload)
        });

        responseData = await response.json();
        if (!response.ok) {
            const errDesc = responseData.error_messages?.[0]?.description || "";
            if (errDesc.includes("CPF") || errDesc.includes("CNPJ") || responseData.error_messages?.[0]?.code === "40002") {
                throw new Error("CPF_REQUIRED: O CPF informado é inválido matematicamente.");
            }
            throw new Error(errDesc || "Erro ao gerar PIX PagBank.");
        }

        pagbank_order_id = responseData.id;
        qr_code = responseData.qr_codes?.[0]?.links?.find((l: any) => l.media === 'image/png')?.href;
        qr_code_text = responseData.qr_codes?.[0]?.text;

        if (!qr_code || !qr_code_text) throw new Error("Dados do QR Code não retornados.");
    }

    // Salva intenção
    await supabaseAdmin.from('pagbank_payments').insert({
        user_id: user_id,
        reference_id: reference_id,
        pagbank_order_id: pagbank_order_id,
        amount: amount,
        status: 'PENDING',
        payment_type: type,
        metadata: { ...metadata, origin_amount: amount, calculated_fee: (finalAmount - amount) },
        admin_id: config.admin_id
    });

    return new Response(JSON.stringify({ 
      success: true, 
      qr_code, 
      qr_code_text, 
      checkout_link,
      order_id: pagbank_order_id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("[create-pagbank-payment] Erro:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})
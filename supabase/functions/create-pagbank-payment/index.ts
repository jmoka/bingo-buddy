import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { amount, type, metadata, admin_id } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Busca as configurações do PagBank
    let configQuery = supabaseAdmin.from('configuracoes').select('admin_id, pagbank_env, pagbank_token_sandbox, pagbank_token_producao');
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
    let customerTaxId = ''; 

    // Se estiver logado, busca os dados reais do jogador
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
                  customerTaxId = profile.cpf.replace(/\D/g, '');
                }
            }
        }
    }

    // Sobrescreve com metadados do frontend (Venda Avulsa OU Usuário Logado corrigindo o CPF na hora)
    if (metadata?.cliente_nome) customerName = metadata.cliente_nome;
    if (metadata?.customer_cpf) {
        customerTaxId = metadata.customer_cpf.replace(/\D/g, '');
        
        // HIGIENIZAÇÃO: Se o usuário logado enviou um CPF válido novo na compra, salva no perfil dele automaticamente
        if (user_id && (customerTaxId.length === 11 || customerTaxId.length === 14)) {
            // Evita bloquear a transação se der erro ao atualizar o perfil
            supabaseAdmin.from('perfis').update({ cpf: customerTaxId }).eq('id', user_id)
              .then(({error}) => { if(error) console.error("Erro ao atualizar CPF no perfil:", error) });
        }
    }

    // VALIDAÇÃO ESTRITA DE SEGURANÇA (Prevenção de erro 400 da API do PagBank)
    if (!customerTaxId || (customerTaxId.length !== 11 && customerTaxId.length !== 14)) {
        throw new Error("CPF_REQUIRED: É obrigatório informar um CPF ou CNPJ com 11 ou 14 dígitos.");
    }

    // SALVAR DADOS DO COMPRADOR NA CARTELA ANTES DE GERAR O PIX
    try {
      if (type === 'venda_bingo' && metadata?.venda_id) {
          await supabaseAdmin.from('vendas_bingo_fisico').update({
              nome_comprador: customerName,
              telefone_comprador: metadata?.cliente_telefone || null
          }).eq('id', metadata.venda_id);
      } else if (type === 'venda_rifa' && metadata?.venda_id) {
          const { data: cartela } = await supabaseAdmin.from('cartelas_rifa').select('numero_rifa_id').eq('compra_id', metadata.venda_id).maybeSingle();
          if (cartela?.numero_rifa_id) {
              await supabaseAdmin.from('numeros_rifa').update({
                  nome_comprador: customerName,
                  telefone_comprador: metadata?.cliente_telefone || null
              }).eq('id', cartela.numero_rifa_id);
          }
      }
    } catch (err) {
       console.error("[create-pagbank-payment] Erro ao pre-salvar comprador:", err);
    }

    // Criar o Payload para o PagBank (Orders API)
    const reference_id = `${type.toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const valorEmCentavos = Math.round(Number(amount) * 100);

    const pagbankPayload = {
      reference_id: reference_id,
      customer: {
        name: customerName,
        email: customerEmail,
        tax_id: customerTaxId,
      },
      items: [{
        name: type === 'credits' ? 'Créditos Bingo Show' : 'Bilhete Bingo Show',
        quantity: 1,
        unit_amount: valorEmCentavos
      }],
      qr_codes: [{
        amount: { value: valorEmCentavos },
        expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Expira em 24h
      }],
      notification_urls: [`${Deno.env.get('SUPABASE_URL')}/functions/v1/pagbank-webhook`]
    };

    console.log(`[create-pagbank-payment] Payload enviado:`, JSON.stringify(pagbankPayload));

    const response = await fetch(`${apiUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-api-version': '4.0'
      },
      body: JSON.stringify(pagbankPayload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("[create-pagbank-payment] Erro PagBank:", responseData);
      const errorDesc = responseData.error_messages?.[0]?.description || "";
      
      // FAIL SAFE: Intercepta o erro de validação matemática do PagBank e devolve de forma legível
      if (errorDesc.includes("CPF") || errorDesc.includes("CNPJ") || responseData.error_messages?.[0]?.code === "40002") {
          throw new Error("CPF_REQUIRED: O CPF informado é inválido matematicamente.");
      }
      
      throw new Error(errorDesc || "Erro ao gerar PIX no PagBank.");
    }

    const qrCodeImage = responseData.qr_codes?.[0]?.links?.find((l: any) => l.media === 'image/png')?.href;
    const qrCodeText = responseData.qr_codes?.[0]?.text;

    if (!qrCodeImage || !qrCodeText) {
        throw new Error("PagBank não retornou os dados do QR Code.");
    }

    // Salva a intenção de pagamento no nosso banco para validação futura no webhook
    await supabaseAdmin.from('pagbank_payments').insert({
        user_id: user_id,
        reference_id: reference_id,
        pagbank_order_id: responseData.id,
        amount: amount,
        status: 'PENDING',
        payment_type: type,
        metadata: metadata,
        admin_id: config.admin_id
    });

    return new Response(JSON.stringify({ 
      success: true, 
      qr_code: qrCodeImage, 
      qr_code_text: qrCodeText, 
      order_id: responseData.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("[create-pagbank-payment] Fatal Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
})
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { matchId, playerCardIds } = await req.json()
    
    if (!matchId || !playerCardIds || !Array.isArray(playerCardIds) || playerCardIds.length === 0) {
      throw new Error("matchId e playerCardIds são obrigatórios.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error("Token de autorização não encontrado.");
    }
    
    const userSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser()
    if (userError || !user) throw new Error("Usuário não encontrado ou token expirado.");

    console.log(`[join-match] Usuário ${user.id} tentando entrar na partida ${matchId} com ${playerCardIds.length} cartelas.`);

    // Verifica se a partida existe e o valor
    const { data: match, error: matchResError } = await supabaseAdmin
        .from('partidas')
        .select('card_price, pot')
        .eq('id', matchId)
        .single();
        
    if (matchResError || !match) throw new Error(`Partida não encontrada.`);

    // Verifica o perfil do jogador
    const { data: profile, error: profileResError } = await supabaseAdmin
        .from('perfis')
        .select('credits, bloqueado')
        .eq('id', user.id)
        .single();
        
    if (profileResError || !profile) throw new Error(`Perfil não encontrado.`);
    if (profile.bloqueado) throw new Error("Sua conta está bloqueada.");

    // Busca as cartelas originais selecionadas
    const { data: playerCards, error: playerCardsResError } = await supabaseAdmin
        .from('cartelas_jogador')
        .select('*')
        .in('id', playerCardIds);
        
    if (playerCardsResError || !playerCards) throw new Error(`Erro ao buscar suas cartelas.`);
    if (playerCards.length === 0) throw new Error(`Nenhuma cartela válida encontrada.`);

    // Verifica se alguma cartela já está na partida
    const { data: existingMatchCards, error: existingError } = await supabaseAdmin
      .from('cartelas_partida')
      .select('player_card_id')
      .eq('match_id', matchId)
      .in('player_card_id', playerCardIds);

    if (existingError) throw new Error(`Erro de banco ao verificar duplicatas.`);
    if (existingMatchCards && existingMatchCards.length > 0) {
        throw new Error("Uma ou mais cartelas já estão na partida.");
    }

    // Calcula o custo das cartelas 'reais'
    const realCards = playerCards.filter(c => c.credit_type === 'real');
    const totalCost = realCards.length * match.card_price;

    if (profile.credits < totalCost) {
      throw new Error(`Créditos insuficientes! Você precisa de ${totalCost} créditos.`);
    }

    // Processa a cobrança (apenas cartelas reais)
    if (totalCost > 0) {
      const { error: creditError } = await supabaseAdmin
        .from('perfis')
        .update({ credits: profile.credits - totalCost })
        .eq('id', user.id);
      if (creditError) throw new Error(`Falha ao processar o pagamento.`);
    }

    // Remove 1 uso das cartelas originais
    for (const card of playerCards) {
        await supabaseAdmin
            .from('cartelas_jogador')
            .update({ uses_left: Math.max(0, card.uses_left - 1) })
            .eq('id', card.id);
    }

    // Cria as cartelas da partida (IMPORTANTE: marked_numbers deve ser um array simples do postgres `[0]`)
    const newMatchCards = playerCards.map(card => ({
      player_id: user.id,
      match_id: matchId,
      player_card_id: card.id,
      name: card.name,
      numbers: card.numbers, // jsonb no banco
      marked_numbers: [0],   // Integer[] no banco: espaço central gratuito
      credit_type: card.credit_type,
    }));

    const { data: insertedMatchCards, error: insertError } = await supabaseAdmin
      .from('cartelas_partida')
      .insert(newMatchCards)
      .select();
    
    if (insertError) {
        console.error("[join-match] Falha no insert das cartelas: ", insertError);
        throw new Error(`Falha ao alocar as cartelas na partida.`);
    }

    // Atualiza o pote da partida (apenas com o custo real)
    if (totalCost > 0) {
      await supabaseAdmin.from('partidas').update({ pot: match.pot + totalCost }).eq('id', matchId);
    }

    console.log(`[join-match] Sucesso! ${insertedMatchCards.length} cartelas inseridas.`);

    return new Response(JSON.stringify({ success: true, data: insertedMatchCards }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("[join-match] Erro controlado:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
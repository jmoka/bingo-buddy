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
    const { matchId, playerCardIds, refCode } = await req.json()
    
    if (!matchId || !playerCardIds || !Array.isArray(playerCardIds) || playerCardIds.length === 0) {
      throw new Error("matchId e playerCardIds são obrigatórios.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Token de autorização não encontrado.");
    
    const userSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser()
    if (userError || !user) throw new Error("Usuário não encontrado ou token expirado.");

    // Verifica se as cartelas já estão na partida
    const { data: existingMatchCards, error: existingError } = await supabaseAdmin
      .from('cartelas_partida')
      .select('player_card_id')
      .eq('match_id', matchId)
      .in('player_card_id', playerCardIds);

    if (existingError) throw new Error(`Erro de banco ao verificar duplicatas.`);
    if (existingMatchCards && existingMatchCards.length > 0) {
        throw new Error("Uma ou mais cartelas já estão na partida.");
    }

    const [matchRes, profileRes, playerCardsRes] = await Promise.all([
      supabaseAdmin.from('partidas').select('card_price, pot').eq('id', matchId).single(),
      supabaseAdmin.from('perfis').select('credits, fake_credits, bloqueado').eq('id', user.id).single(),
      supabaseAdmin.from('cartelas_jogador').select('*').in('id', playerCardIds)
    ]);

    if (matchRes.error) throw new Error(`Partida não encontrada.`);
    if (profileRes.error) throw new Error(`Perfil não encontrado.`);
    if (playerCardsRes.error) throw new Error(`Erro ao buscar cartelas.`);

    const match = matchRes.data;
    const profile = profileRes.data;
    const playerCards = playerCardsRes.data;

    // Verifica limite de cartelas ativas na partida para o usuário
    const { count: currentCardsCount, error: countError } = await supabaseAdmin
      .from('cartelas_partida')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', matchId)
      .eq('player_id', user.id);

    if (countError) throw new Error("Erro ao verificar o limite de cartelas.");

    if ((currentCardsCount || 0) + playerCardIds.length > match.max_cards_per_player) {
      throw new Error(`Limite excedido! Você só pode ter no máximo ${match.max_cards_per_player} cartelas nesta partida.`);
    }

    if (profile.bloqueado) {
      throw new Error("Sua conta está bloqueada.");
    }

    const realCards = playerCards.filter(c => c.credit_type === 'real');
    const fakeCards = playerCards.filter(c => c.credit_type === 'fake');
    
    const realCost = realCards.length * match.card_price;
    const fakeCost = fakeCards.length * match.card_price;

    if (profile.credits < realCost) {
      throw new Error(`Créditos reais insuficientes! Você precisa de ${realCost} créditos reais.`);
    }
    
    if ((profile.fake_credits || 0) < fakeCost) {
      throw new Error(`Créditos de brincar insuficientes! Você precisa de ${fakeCost} créditos de brincar.`);
    }

    // --- LÓGICA DE COMISSÃO DO BINGO VIA LINK DE INDICAÇÃO (Apenas Crédito Real) ---
    let commissionAmount = 0;
    let sellerUserId = null;
    let vendedorDaTabelaId = null;

    if (refCode && realCost > 0) {
      const { data: seller } = await supabaseAdmin
        .from('vendedores_rifa')
        .select('id, user_id, comissao_percentual')
        .eq('codigo_ref', refCode)
        .eq('ativo', true)
        .single();

      if (seller && seller.user_id) {
        let comissao = seller.comissao_percentual;
        vendedorDaTabelaId = seller.id;

        if (!comissao || comissao === 0) {
          const { data: cfg } = await supabaseAdmin.from('configuracoes').select('comissao_vendedor_global').single();
          comissao = cfg?.comissao_vendedor_global || 0;
        }
        if (comissao > 0) {
          commissionAmount = realCost * (comissao / 100.0);
          sellerUserId = seller.user_id;
        }
      }
    }

    // 1. Desconta o custo do jogador (Real e Brincar)
    const profileUpdates: any = {};
    if (realCost > 0) profileUpdates.credits = profile.credits - realCost;
    if (fakeCost > 0) profileUpdates.fake_credits = (profile.fake_credits || 0) - fakeCost;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: creditError } = await supabaseAdmin
        .from('perfis')
        .update(profileUpdates)
        .eq('id', user.id);
      if (creditError) throw new Error(`Falha ao debitar os créditos.`);
    }

    // 2. Paga a comissão ao vendedor e desconta do lucro do admin (Apenas Real)
    if (sellerUserId && commissionAmount > 0) {
      console.log(`[join-match] Pagando comissão de ${commissionAmount} ao vendedor ${sellerUserId}`);
      await supabaseAdmin.rpc('increment_player_credits', { p_player_id: sellerUserId, p_amount: commissionAmount });
      await supabaseAdmin.rpc('increment_admin_profit', { amount: -commissionAmount });
    }

    for (const card of playerCards) {
        await supabaseAdmin
            .from('cartelas_jogador')
            .update({ uses_left: Math.max(0, card.uses_left - 1) })
            .eq('id', card.id);
    }

    // INSERE O VENDEDOR ID NA CARTELA DA PARTIDA!
    const newMatchCards = playerCards.map(card => ({
      player_id: user.id,
      match_id: matchId,
      player_card_id: card.id,
      name: card.name,
      numbers: card.numbers,
      marked_numbers: [0],
      credit_type: card.credit_type,
      vendedor_id: vendedorDaTabelaId
    }));

    const { data: insertedMatchCards, error: insertError } = await supabaseAdmin
      .from('cartelas_partida')
      .insert(newMatchCards)
      .select();
    
    if (insertError) {
        throw new Error(`Falha ao alocar as cartelas na partida.`);
    }

    if (realCost > 0) {
      const currentPot = Number(match.pot || 0);
      await supabaseAdmin.from('partidas').update({ pot: currentPot + realCost }).eq('id', matchId);
    }

    return new Response(JSON.stringify({ success: true, data: insertedMatchCards }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("[join-match] Erro:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
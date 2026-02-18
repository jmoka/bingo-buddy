import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

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
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }
    const userSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser()
    if (userError || !user) throw new Error("Usuário não encontrado ou token inválido.");

    const { data: existingMatchCards, error: existingError } = await supabaseAdmin
      .from('cartelas_partida')
      .select('player_card_id')
      .eq('match_id', matchId)
      .in('player_card_id', playerCardIds);

    if (existingError) throw new Error(`Erro ao verificar cartelas: ${existingError.message}`);
    if (existingMatchCards && existingMatchCards.length > 0) throw new Error("Uma ou mais cartelas já estão na partida.");

    const [matchRes, profileRes, playerCardsRes] = await Promise.all([
      supabaseAdmin.from('partidas').select('card_price, pot').eq('id', matchId).single(),
      supabaseAdmin.from('perfis').select('credits').eq('id', user.id).single(),
      supabaseAdmin.from('cartelas_jogador').select('*').in('id', playerCardIds)
    ]);

    if (matchRes.error) throw new Error(`Partida não encontrada.`);
    if (profileRes.error) throw new Error(`Perfil não encontrado.`);
    if (playerCardsRes.error) throw new Error(`Erro ao buscar cartelas.`);

    const match = matchRes.data;
    const profile = profileRes.data;
    const playerCards = playerCardsRes.data;

    // Calcula o custo apenas para as cartelas que são 'real'
    const realCards = playerCards.filter(c => c.credit_type === 'real');
    const totalCost = realCards.length * match.card_price;

    if (profile.credits < totalCost) {
      throw new Error("Créditos insuficientes para as cartelas reais!");
    }

    // Debita apenas se houver custo (cartelas reais)
    if (totalCost > 0) {
      const { error: creditError } = await supabaseAdmin
        .from('perfis')
        .update({ credits: profile.credits - totalCost })
        .eq('id', user.id);
      if (creditError) throw new Error(`Erro ao debitar créditos.`);
    }

    const cardUpdatePromises = playerCards.map(card => 
      supabaseAdmin
        .from('cartelas_jogador')
        .update({ uses_left: card.uses_left - 1 })
        .eq('id', card.id)
    );
    await Promise.all(cardUpdatePromises);

    const newMatchCards = playerCards.map(card => ({
      player_id: user.id,
      match_id: matchId,
      player_card_id: card.id,
      name: card.name,
      numbers: card.numbers,
      marked_numbers: [],
      credit_type: card.credit_type, // Importante: mantém o tipo na partida
    }));

    const { data: insertedMatchCards, error: insertError } = await supabaseAdmin
      .from('cartelas_partida')
      .insert(newMatchCards)
      .select();
    
    if (insertError) throw new Error(`Erro ao inscrever cartelas.`);

    // Apenas aumenta o pote se as cartelas forem pagas (reais)
    if (totalCost > 0) {
      await supabaseAdmin.from('partidas').update({ pot: match.pot + totalCost }).eq('id', matchId);
    }

    return new Response(JSON.stringify(insertedMatchCards), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
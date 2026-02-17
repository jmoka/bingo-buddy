import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { checkWin } from '../_shared/bingoUtils.ts'
import type { Match, MatchCard, Winner, BingoCard } from '../_shared/types.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { matchId, num } = await req.json()
    console.log(`[call-number] Received call for match ${matchId}, number ${num}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: match, error: matchError } = await supabaseAdmin
      .from('partidas')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchError) throw matchError
    if (!match || match.called_numbers.includes(num) || match.status !== 'in_progress') {
      console.log('[call-number] Invalid request: Match not found, number already called, or match not in progress.');
      return new Response(JSON.stringify({ error: 'Invalid number or match state.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const { data: matchCards, error: cardsError } = await supabaseAdmin
      .from('cartelas_partida')
      .select('*')
      .eq('match_id', matchId)
    
    if (cardsError) throw cardsError

    const cardsToUpdate = matchCards.filter(c =>
      c.numbers.flat().includes(num) &&
      !c.marked_numbers.includes(num)
    )

    if (cardsToUpdate.length > 0) {
      console.log(`[call-number] Updating ${cardsToUpdate.length} cards.`);
      const updatePromises = cardsToUpdate.map(card => {
        const newMarkedNumbers = [...card.marked_numbers, num]
        return supabaseAdmin
          .from('cartelas_partida')
          .update({ marked_numbers: newMarkedNumbers })
          .eq('id', card.id)
      })
      await Promise.all(updatePromises)
    }

    const { data: freshMatchCards, error: freshCardsError } = await supabaseAdmin
      .from('cartelas_partida')
      .select('*')
      .eq('match_id', matchId)
    
    if (freshCardsError) throw freshCardsError

    const { data: players, error: playersError } = await supabaseAdmin.from('perfis').select('id, full_name')
    if (playersError) throw playersError

    const foundWinners = []
    for (const card of freshMatchCards) {
      const tempBingoCard: BingoCard = {
        id: card.id,
        name: card.name,
        numbers: card.numbers,
        markedNumbers: new Set(card.marked_numbers),
      };
      const winResult = checkWin(tempBingoCard, match.game_type);
      if (winResult) {
        foundWinners.push({ card, result: winResult });
      }
    }

    const newCalledNumbers = [...match.called_numbers, num]
    let matchUpdatePayload: Partial<Match> = { 
      called_numbers: newCalledNumbers,
    }

    if (match.is_auto_calling) {
      const { data: settings } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
      const interval = settings?.intervalo_sorteio_auto_seg || 120;
      matchUpdatePayload.next_auto_call_timestamp = new Date(Date.now() + interval * 1000).toISOString();
    }

    if (foundWinners.length > 0) {
      console.log(`[call-number] Found ${foundWinners.length} winners!`);
      const winnerData: Winner[] = foundWinners.map(fw => ({
        playerId: fw.card.player_id,
        playerName: players?.find(p => p.id === fw.card.player_id)?.full_name || 'Desconhecido',
        cardId: fw.card.id,
        cardName: fw.card.name,
      }));

      matchUpdatePayload = {
        ...matchUpdatePayload,
        status: 'finished',
        winners: winnerData,
        is_auto_calling: false,
        next_auto_call_timestamp: null,
      };
    }

    const { error: updateMatchError } = await supabaseAdmin
      .from('partidas')
      .update(matchUpdatePayload)
      .eq('id', matchId)

    if (updateMatchError) throw updateMatchError

    console.log('[call-number] Successfully processed number call.');
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('[call-number] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
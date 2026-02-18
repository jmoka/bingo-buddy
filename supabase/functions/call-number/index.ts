import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { checkWin } from '../_shared/bingoUtils.ts'
import type { Match, Winner, BingoCard } from '../_shared/types.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { matchId, num } = await req.json()
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: match, error: matchError } = await supabaseAdmin
      .from('partidas')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchError || !match || match.status !== 'in_progress') {
      return new Response(JSON.stringify({ error: 'Partida não disponível.' }), { status: 400 });
    }

    if (match.called_numbers.includes(num)) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
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
      const updatePromises = cardsToUpdate.map(card => {
        const newMarkedNumbers = [...card.marked_numbers, num]
        return supabaseAdmin
          .from('cartelas_partida')
          .update({ marked_numbers: newMarkedNumbers })
          .eq('id', card.id)
      })
      await Promise.all(updatePromises)
    }

    const { data: freshMatchCards } = await supabaseAdmin
      .from('cartelas_partida')
      .select('*')
      .eq('match_id', matchId)

    const foundWinners = []
    for (const card of freshMatchCards || []) {
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
    let matchUpdatePayload: any = { called_numbers: newCalledNumbers }

    if (match.is_auto_calling) {
      const { data: settings } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
      const interval = settings?.intervalo_sorteio_auto_seg || 120;
      matchUpdatePayload.next_auto_call_timestamp = new Date(Date.now() + interval * 1000).toISOString();
    }

    if (foundWinners.length > 0) {
      const { data: allProfiles } = await supabaseAdmin.from('perfis').select('id, full_name');
      
      const winnerData: Winner[] = foundWinners.map(fw => ({
        playerId: fw.card.player_id,
        playerName: allProfiles?.find(p => p.id === fw.card.player_id)?.full_name || 'Jogador',
        cardId: fw.card.id,
        cardName: fw.card.name,
      }));

      // Calcula prêmio apenas considerando quem usou cartela real
      const realWinners = foundWinners.filter(fw => fw.card.credit_type === 'real');
      let prizeAmountPerRealWinner = 0;
      
      if (realWinners.length > 0) {
        if (match.prize.type === 'fixed') {
          prizeAmountPerRealWinner = Number(match.prize.value || 0);
        } else if (match.prize.type === 'percentage') {
          const totalPrize = (match.pot * (Number(match.prize.value) || 0)) / 100;
          prizeAmountPerRealWinner = Math.floor(totalPrize / realWinners.length);
        }
      }

      for (const fw of foundWinners) {
        const isReal = fw.card.credit_type === 'real';
        
        // Registra vitória apenas se for Real (ou se quiser manter histórico de diversão, mas sem prêmio)
        if (isReal) {
            await supabaseAdmin.from('vitorias').insert({
              match_id: match.id,
              player_id: fw.card.player_id,
              player_card_id: fw.card.player_card_id,
              match_card_id: fw.card.id,
              prize_details: match.prize,
            });

            if (prizeAmountPerRealWinner > 0) {
              const { data: prof } = await supabaseAdmin.from('perfis').select('credits').eq('id', fw.card.player_id).single();
              if (prof) {
                await supabaseAdmin.from('perfis').update({ credits: prof.credits + prizeAmountPerRealWinner }).eq('id', fw.card.player_id);
              }
            }
        }
      }

      matchUpdatePayload = {
        ...matchUpdatePayload,
        status: 'finished',
        winners: winnerData,
        is_auto_calling: false,
        next_auto_call_timestamp: null,
      };
    }

    await supabaseAdmin.from('partidas').update(matchUpdatePayload).eq('id', matchId)

    return new Response(JSON.stringify({ success: true, winners: foundWinners.length }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
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

    if (matchError || !match) throw new Error("Partida não encontrada.");
    if (match.status === 'finished') return new Response(JSON.stringify({ success: true, message: 'Partida já finalizada.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (match.called_numbers.includes(num)) return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: matchCards, error: cardsError } = await supabaseAdmin.from('cartelas_partida').select('*').eq('match_id', matchId)
    if (cardsError) throw cardsError

    const cardsToUpdate = (matchCards || []).filter(c => c.numbers.flat().includes(num) && !(c.marked_numbers || []).includes(num))
    if (cardsToUpdate.length > 0) {
      const updatePromises = cardsToUpdate.map(card => supabaseAdmin.from('cartelas_partida').update({ marked_numbers: [...(card.marked_numbers || []), num] }).eq('id', card.id))
      await Promise.all(updatePromises)
    }

    const { data: freshMatchCards } = await supabaseAdmin.from('cartelas_partida').select('*').eq('match_id', matchId)
    const foundWinners = []
    for (const card of freshMatchCards || []) {
      const tempBingoCard: BingoCard = { id: card.id, name: card.name, numbers: card.numbers, markedNumbers: new Set(card.marked_numbers || []) };
      const winResult = checkWin(tempBingoCard, match.game_type);
      if (winResult) foundWinners.push({ card, result: winResult });
    }

    const newCalledNumbers = [...(match.called_numbers || []), num]
    let matchUpdatePayload: any = { called_numbers: newCalledNumbers }

    if (match.is_auto_calling && foundWinners.length === 0) {
      const { data: settings } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
      const interval = settings?.intervalo_sorteio_auto_seg || 120;
      matchUpdatePayload.next_auto_call_timestamp = new Date(Date.now() + interval * 1000).toISOString();
    }

    if (foundWinners.length > 0) {
      const { data: allProfiles } = await supabaseAdmin.from('perfis').select('id, full_name');
      const winnerData: Winner[] = foundWinners.map(fw => ({ playerId: fw.card.player_id, playerName: allProfiles?.find(p => p.id === fw.card.player_id)?.full_name || 'Jogador', cardId: fw.card.id, cardName: fw.card.name }));

      const realWinners = foundWinners.filter(fw => fw.card.credit_type === 'real');
      let prizeAmountPerRealWinner = 0;
      let adminProfit = 0;

      if (realWinners.length > 0) {
        if (match.prize.type === 'fixed') {
          prizeAmountPerRealWinner = Number(match.prize.value || 0);
          adminProfit = match.pot - (prizeAmountPerRealWinner * realWinners.length);
        } else if (match.prize.type === 'percentage') {
          const totalPrizeToWinners = Math.floor((match.pot * (Number(match.prize.value) || 0)) / 100);
          adminProfit = match.pot - totalPrizeToWinners;
          prizeAmountPerRealWinner = Math.floor(totalPrizeToWinners / realWinners.length);
        }
      } else {
        adminProfit = match.pot;
      }

      if (adminProfit > 0) {
        await supabaseAdmin.rpc('increment_admin_profit', { amount: adminProfit });
      }

      for (const fw of foundWinners) {
        if (fw.card.credit_type === 'real') {
          await supabaseAdmin.from('vitorias').insert({ match_id: match.id, player_id: fw.card.player_id, player_card_id: fw.card.player_card_id, match_card_id: fw.card.id, prize_details: match.prize });
          if (prizeAmountPerRealWinner > 0) {
            const { data: prof } = await supabaseAdmin.from('perfis').select('credits').eq('id', fw.card.player_id).single();
            if (prof) await supabaseAdmin.from('perfis').update({ credits: prof.credits + prizeAmountPerRealWinner }).eq('id', fw.card.player_id);
          }
        }
      }

      matchUpdatePayload = { ...matchUpdatePayload, status: 'finished', winners: winnerData, is_auto_calling: false, next_auto_call_timestamp: null, admin_profit_from_match: adminProfit };
    }

    const { error: finalUpdateError } = await supabaseAdmin.from('partidas').update(matchUpdatePayload).eq('id', matchId)
    if (finalUpdateError) throw finalUpdateError;

    return new Response(JSON.stringify({ success: true, winners: foundWinners.length }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error(`[call-number] Erro fatal: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
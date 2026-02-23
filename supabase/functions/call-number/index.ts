import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { checkWin } from '../_shared/bingoUtils.ts'
import type { Winner, BingoCard } from '../_shared/types.ts'

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

    // 1. Lock da partida
    const { data: gotLock } = await supabaseAdmin.rpc('try_lock_match', { p_match_id: matchId });
    if (!gotLock) return new Response(JSON.stringify({ success: true, message: 'Ocupado' }), { headers: corsHeaders });

    // 2. Adiciona número e marca cartelas
    const { data: appendResult } = await supabaseAdmin.rpc('append_called_number', { p_match_id: matchId, p_num: num });
    if (!appendResult || appendResult.status === 'finished' || appendResult.already_called) {
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
    await supabaseAdmin.rpc('mark_number_for_match_cards', { p_match_id: matchId, p_num: num });

    // 3. Busca dados da partida e cartelas
    const { data: match } = await supabaseAdmin.from('partidas').select('*').eq('id', matchId).single();
    const { data: matchCards } = await supabaseAdmin.from('cartelas_partida').select('*').eq('match_id', matchId);
    const { data: allProfiles } = await supabaseAdmin.from('perfis').select('id, full_name');

    // 4. Verifica novos vencedores (ignorando quem já ganhou antes nesta partida)
    const existingWinnerCardIds = new Set((match.winners || []).map((w: any) => w.cardId));
    const newWinnersFound = [];

    for (const card of matchCards || []) {
      if (existingWinnerCardIds.has(card.id)) continue;

      const tempBingoCard: BingoCard = { id: card.id, name: card.name, numbers: card.numbers, markedNumbers: new Set(card.marked_numbers || []) };
      const winResult = checkWin(tempBingoCard, match.game_type);
      
      if (winResult) {
        newWinnersFound.push({ card, result: winResult });
      }
    }

    let matchUpdatePayload: any = {};
    const currentWinners = [...(match.winners || [])];

    if (newWinnersFound.length > 0) {
      const realWinners = newWinnersFound.filter(fw => fw.card.credit_type === 'real');
      const funWinners = newWinnersFound.filter(fw => fw.card.credit_type === 'fake');

      // Registra TODAS as vitórias no banco (para o Ranking)
      for (const fw of newWinnersFound) {
        await supabaseAdmin.rpc('record_winner', {
          p_match_id: match.id,
          p_player_id: fw.card.player_id,
          p_player_card_id: fw.card.player_card_id,
          p_match_card_id: fw.card.id,
          p_prize_details: match.prize
        });
        
        currentWinners.push({
          playerId: fw.card.player_id,
          playerName: allProfiles?.find(p => p.id === fw.card.player_id)?.full_name || 'Jogador',
          cardId: fw.card.id,
          cardName: fw.card.name,
          creditType: fw.card.credit_type // Adicionado para o UI saber
        });
      }

      // Lógica de finalização ou continuidade
      if (realWinners.length > 0) {
        // Se houver vencedores REAIS, o jogo termina e paga o prêmio
        const prizeAmountPerRealWinner = match.prize.type === 'fixed' 
          ? Number(match.prize.value || 0) 
          : (match.pot * (Number(match.prize.value) || 0)) / 100 / realWinners.length;

        const adminProfit = match.pot - (prizeAmountPerRealWinner * realWinners.length);
        if (adminProfit > 0) await supabaseAdmin.rpc('increment_admin_profit', { amount: adminProfit });

        for (const rw of realWinners) {
          if (prizeAmountPerRealWinner > 0) {
            await supabaseAdmin.rpc('increment_player_credits', { p_player_id: rw.card.player_id, p_amount: prizeAmountPerRealWinner });
          }
        }

        matchUpdatePayload = { status: 'finished', winners: currentWinners, is_auto_calling: false, next_auto_call_timestamp: null, admin_profit_from_match: adminProfit };
      } else {
        // Apenas vencedores de BRINCAR
        const remainingRealCards = matchCards.filter(c => c.credit_type === 'real' && !existingWinnerCardIds.has(c.id));
        
        if (remainingRealCards.length > 0) {
          // Jogo continua porque ainda tem gente com dinheiro real jogando
          matchUpdatePayload = { winners: currentWinners };
          if (match.is_auto_calling) {
            const { data: settings } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
            matchUpdatePayload.next_auto_call_timestamp = new Date(Date.now() + (settings?.intervalo_sorteio_auto_seg || 120) * 1000).toISOString();
          }
        } else {
          // Não tem mais ninguém real jogando, finaliza o jogo
          matchUpdatePayload = { status: 'finished', winners: currentWinners, is_auto_calling: false, next_auto_call_timestamp: null, admin_profit_from_match: match.pot };
          if (match.pot > 0) await supabaseAdmin.rpc('increment_admin_profit', { amount: match.pot });
        }
      }
    } else if (match.is_auto_calling) {
      const { data: settings } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
      matchUpdatePayload.next_auto_call_timestamp = new Date(Date.now() + (settings?.intervalo_sorteio_auto_seg || 120) * 1000).toISOString();
    }

    if (Object.keys(matchUpdatePayload).length > 0) {
      await supabaseAdmin.from('partidas').update(matchUpdatePayload).eq('id', matchId);
    }

    return new Response(JSON.stringify({ success: true, winners: newWinnersFound.length }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})
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

    // 1. Tenta obter um lock exclusivo para esta partida. Se falhar, outra execução já está em andamento.
    const { data: gotLock, error: lockError } = await supabaseAdmin.rpc('try_lock_match', { p_match_id: matchId });
    if (lockError) throw lockError;
    if (!gotLock) {
      console.log(`[call-number] Partida ${matchId} ocupada. Pulando.`);
      return new Response(JSON.stringify({ success: true, message: 'Partida ocupada, outra execução em andamento.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Adiciona o número sorteado de forma atômica. A RPC já verifica se a partida está finalizada ou se o número já foi chamado.
    const { data: appendResult, error: appendError } = await supabaseAdmin.rpc('append_called_number', { p_match_id: matchId, p_num: num });
    if (appendError) throw appendError;

    if (appendResult.status === 'finished' || appendResult.already_called) {
      return new Response(JSON.stringify({ success: true, message: 'Número já sorteado ou partida finalizada.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Marca o número em todas as cartelas da partida de forma atômica e performática.
    await supabaseAdmin.rpc('mark_number_for_match_cards', { p_match_id: matchId, p_num: num });

    // 4. Busca os dados necessários para a verificação de vencedores.
    const { data: match, error: matchError } = await supabaseAdmin.from('partidas').select('*').eq('id', matchId).single();
    if (matchError || !match) throw new Error("Partida não encontrada após o lock.");

    const { data: freshMatchCards, error: cardsError } = await supabaseAdmin.from('cartelas_partida').select('*').eq('match_id', matchId);
    if (cardsError) throw cardsError;

    // 5. Verifica se há vencedores.
    const foundWinners = [];
    for (const card of freshMatchCards || []) {
      const tempBingoCard: BingoCard = { id: card.id, name: card.name, numbers: card.numbers, markedNumbers: new Set(card.marked_numbers || []) };
      const winResult = checkWin(tempBingoCard, match.game_type);
      if (winResult) foundWinners.push({ card, result: winResult });
    }

    let matchUpdatePayload: any = {};

    // 6. Processa os vencedores ou continua a partida.
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
          const totalPrizeToWinners = (match.pot * (Number(match.prize.value) || 0)) / 100;
          adminProfit = match.pot - totalPrizeToWinners;
          prizeAmountPerRealWinner = totalPrizeToWinners / realWinners.length;
        }
      } else {
        adminProfit = match.pot;
      }

      if (adminProfit > 0) {
        await supabaseAdmin.rpc('increment_admin_profit', { amount: adminProfit });
      }

      for (const fw of foundWinners) {
        if (fw.card.credit_type === 'real') {
          // Registra a vitória de forma idempotente.
          await supabaseAdmin.rpc('record_winner', {
            p_match_id: match.id,
            p_player_id: fw.card.player_id,
            p_player_card_id: fw.card.player_card_id,
            p_match_card_id: fw.card.id,
            p_prize_details: match.prize
          });
          // Paga o prêmio de forma atômica.
          if (prizeAmountPerRealWinner > 0) {
            await supabaseAdmin.rpc('increment_player_credits', { p_player_id: fw.card.player_id, p_amount: prizeAmountPerRealWinner });
          }
        }
      }

      matchUpdatePayload = { status: 'finished', winners: winnerData, is_auto_calling: false, next_auto_call_timestamp: null, admin_profit_from_match: adminProfit };
    } else if (match.is_auto_calling) {
      // Se não houver vencedores, agenda o próximo sorteio automático.
      const { data: settings } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
      const interval = settings?.intervalo_sorteio_auto_seg || 120;
      matchUpdatePayload.next_auto_call_timestamp = new Date(Date.now() + interval * 1000).toISOString();
    }

    // 7. Atualiza o status final da partida.
    if (Object.keys(matchUpdatePayload).length > 0) {
      const { error: finalUpdateError } = await supabaseAdmin.from('partidas').update(matchUpdatePayload).eq('id', matchId).eq('status', 'in_progress'); // Condição de segurança
      if (finalUpdateError) throw finalUpdateError;
    }

    return new Response(JSON.stringify({ success: true, winners: foundWinners.length }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error(`[call-number] Erro fatal: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
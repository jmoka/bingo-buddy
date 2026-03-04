import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---- bingoUtils inline ----
type GameType = 'horizontal' | 'vertical' | 'diagonal' | 'full';
interface BingoCard { id: string; name: string; numbers: number[][]; markedNumbers: Set<number>; }
interface WinResult { cardId: string; cardName: string; type: GameType; winningNumbers: number[]; }

const isCellMarked = (card: BingoCard, row: number, col: number): boolean => {
  if (row === 2 && col === 2) return true;
  return card.markedNumbers.has(card.numbers[row][col]);
};

const checkHorizontalWin = (card: BingoCard): number[] | null => {
  for (let row = 0; row < 5; row++) {
    if ([0,1,2,3,4].every(col => isCellMarked(card, row, col))) return card.numbers[row];
  }
  return null;
};

const checkVerticalWin = (card: BingoCard): number[] | null => {
  for (let col = 0; col < 5; col++) {
    if ([0,1,2,3,4].every(row => isCellMarked(card, row, col))) return card.numbers.map(r => r[col]);
  }
  return null;
};

const checkDiagonalWin = (card: BingoCard): number[] | null => {
  if ([0,1,2,3,4].every(i => isCellMarked(card, i, i))) return [0,1,2,3,4].map(i => card.numbers[i][i]);
  if ([0,1,2,3,4].every(i => isCellMarked(card, i, 4-i))) return [0,1,2,3,4].map(i => card.numbers[i][4-i]);
  return null;
};

const checkFullCardWin = (card: BingoCard): number[] | null => {
  const all: number[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    if (!isCellMarked(card, r, c)) return null;
    if (!(r === 2 && c === 2)) all.push(card.numbers[r][c]);
  }
  return all;
};

const checkWin = (card: BingoCard, gameType: GameType): WinResult | null => {
  let winning: number[] | null = null;
  if (gameType === 'horizontal') winning = checkHorizontalWin(card);
  else if (gameType === 'vertical') winning = checkVerticalWin(card);
  else if (gameType === 'diagonal') winning = checkDiagonalWin(card);
  else if (gameType === 'full') winning = checkFullCardWin(card);
  if (!winning) return null;
  return { cardId: card.id, cardName: card.name, type: gameType, winningNumbers: winning };
};
// ---- fim bingoUtils ----

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { matchId, specificNumber } = await req.json()
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Lock da partida
    const { data: gotLock } = await supabaseAdmin.rpc('try_lock_match', { p_match_id: matchId });
    if (!gotLock) return new Response(JSON.stringify({ success: true, message: 'Ocupado' }), { headers: corsHeaders });

    // 2. Reler partida após obter o lock para validar o ciclo
    const { data: match } = await supabaseAdmin.from('partidas').select('*').eq('id', matchId).single();

    // Apenas para chamadas automáticas: ignorar se já foi atendido neste ciclo
    if (!specificNumber && match.next_auto_call_timestamp && new Date(match.next_auto_call_timestamp).getTime() > Date.now()) {
      return new Response(JSON.stringify({ success: true, message: 'already_called_this_cycle' }), { headers: corsHeaders });
    }

    // 3. Determinar número a sortear
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
      .filter((n: number) => !(match.called_numbers || []).includes(n));

    if (availableNumbers.length === 0) {
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    const num = (specificNumber && availableNumbers.includes(specificNumber))
      ? specificNumber
      : availableNumbers[Math.floor(Math.random() * availableNumbers.length)];

    // 4. Adiciona número e marca cartelas
    const { data: appendResult } = await supabaseAdmin.rpc('append_called_number', { p_match_id: matchId, p_num: num });
    if (!appendResult || appendResult.status === 'finished' || appendResult.already_called) {
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
    await supabaseAdmin.rpc('mark_number_for_match_cards', { p_match_id: matchId, p_num: num });

    // 5. Busca cartelas e perfis
    const { data: matchCards } = await supabaseAdmin.from('cartelas_partida').select('*').eq('match_id', matchId);
    const { data: allProfiles } = await supabaseAdmin.from('perfis').select('id, full_name');

    // Usar called_numbers + novo número como fonte de verdade (evita race condition)
    const allCalledNumbers = new Set([...(match.called_numbers || []), num]);

    console.log('[call-number] num=', num, 'allCalledNumbers.size=', allCalledNumbers.size, 'game_type=', match.game_type);
    console.log('[call-number] matchCards count=', (matchCards || []).length);
    for (const card of matchCards || []) {
      const flat = (card.numbers as number[][]).flat().map(Number);
      const markedCount = flat.filter((n: number) => allCalledNumbers.has(n)).length;
      console.log('[call-number] card=', card.id, 'name=', card.name, 'credit_type=', card.credit_type, 'flat.length=', flat.length, 'markedCount=', markedCount);
      console.log('[call-number] card.numbers sample=', JSON.stringify(card.numbers).substring(0, 80));
      const flat0 = (card.numbers as number[][])[0];
      if (flat0) console.log('[call-number] row0 types=', flat0.map((x: unknown) => typeof x));
    }

    // 6. Verifica novos vencedores
    const existingWinnerCardIds = new Set((match.winners || []).map((w: { cardId: string }) => w.cardId));
    const newWinnersFound: { card: any; result: WinResult }[] = [];

    for (const card of matchCards || []) {
      if (existingWinnerCardIds.has(card.id)) continue;

      const numbersAsNumbers: number[][] = (card.numbers as unknown[][]).map((row: unknown[]) => row.map((n: unknown) => Number(n)));
      const tempBingoCard: BingoCard = {
        id: card.id,
        name: card.name,
        numbers: numbersAsNumbers,
        markedNumbers: new Set(numbersAsNumbers.flat().filter((n: number) => allCalledNumbers.has(n)))
      };
      const normalizedGameType = String(match.game_type).trim().toLowerCase() as GameType;
      const winResult = checkWin(tempBingoCard, normalizedGameType);
      console.log('[call-number] checkWin card=', card.name, 'result=', winResult ? JSON.stringify(winResult) : 'null', 'markedNumbers.size=', tempBingoCard.markedNumbers.size);
      if (winResult) newWinnersFound.push({ card, result: winResult });
    }

    let matchUpdatePayload: Record<string, unknown> = {};
    const currentWinners = [...(match.winners || [])];

    if (newWinnersFound.length > 0) {
      const realWinners = newWinnersFound.filter(fw => fw.card.credit_type === 'real');

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
          playerName: (allProfiles as { id: string; full_name: string }[])?.find(p => p.id === fw.card.player_id)?.full_name || 'Jogador',
          cardId: fw.card.id,
          cardName: fw.card.name,
          creditType: fw.card.credit_type
        });
      }

      if (realWinners.length > 0) {
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
        const remainingRealCards = (matchCards || []).filter((c: { credit_type: string; id: string }) => c.credit_type === 'real' && !existingWinnerCardIds.has(c.id));

        if (remainingRealCards.length > 0) {
          matchUpdatePayload = { winners: currentWinners };
          if (match.is_auto_calling) {
            const { data: settings } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
            matchUpdatePayload.next_auto_call_timestamp = new Date(Date.now() + ((settings as { intervalo_sorteio_auto_seg: number } | null)?.intervalo_sorteio_auto_seg || 120) * 1000).toISOString();
          }
        } else {
          // Sem cartelas reais: encerrar a partida mostrando vencedores fake
          matchUpdatePayload = { status: 'finished', winners: currentWinners, is_auto_calling: false, next_auto_call_timestamp: null, admin_profit_from_match: match.pot };
          if (match.pot > 0) await supabaseAdmin.rpc('increment_admin_profit', { amount: match.pot });
        }
      }
    } else if (match.is_auto_calling) {
      const { data: settings } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
      matchUpdatePayload.next_auto_call_timestamp = new Date(Date.now() + ((settings as { intervalo_sorteio_auto_seg: number } | null)?.intervalo_sorteio_auto_seg || 120) * 1000).toISOString();
    }

    if (Object.keys(matchUpdatePayload).length > 0) {
      await supabaseAdmin.from('partidas').update(matchUpdatePayload).eq('id', matchId);
    }

    return new Response(JSON.stringify({ success: true, winners: newWinnersFound.length }), { headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
})

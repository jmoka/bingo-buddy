import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---- Lógica de Verificação de Bingo (Garantindo o espaço livre 0) ----
type GameType = 'horizontal' | 'vertical' | 'diagonal' | 'full';
interface BingoCard { id: string; name: string; numbers: number[][]; markedNumbers: Set<number>; }
interface WinResult { cardId: string; cardName: string; type: GameType; winningNumbers: number[]; }

const isCellMarked = (card: BingoCard, row: number, col: number): boolean => {
  const num = Number(card.numbers[row][col]);
  if (num === 0) return true; // O espaço do meio é 0 e está sempre marcado
  return card.markedNumbers.has(num);
};

const checkHorizontalWin = (card: BingoCard): number[] | null => {
  for (let row = 0; row < 5; row++) {
    if ([0,1,2,3,4].every(col => isCellMarked(card, row, col))) return card.numbers[row].map(Number);
  }
  return null;
};

const checkVerticalWin = (card: BingoCard): number[] | null => {
  for (let col = 0; col < 5; col++) {
    if ([0,1,2,3,4].every(row => isCellMarked(card, row, col))) return card.numbers.map(r => Number(r[col]));
  }
  return null;
};

const checkDiagonalWin = (card: BingoCard): number[] | null => {
  if ([0,1,2,3,4].every(i => isCellMarked(card, i, i))) return [0,1,2,3,4].map(i => Number(card.numbers[i][i]));
  if ([0,1,2,3,4].every(i => isCellMarked(card, i, 4-i))) return [0,1,2,3,4].map(i => Number(card.numbers[i][4-i]));
  return null;
};

const checkFullCardWin = (card: BingoCard): number[] | null => {
  const all: number[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    if (!isCellMarked(card, r, c)) return null;
    if (Number(card.numbers[r][c]) !== 0) all.push(Number(card.numbers[r][c]));
  }
  return all;
};

const checkWin = (card: BingoCard, gameType: GameType): WinResult | null => {
  let winning: number[] | null = null;
  const type = String(gameType).toLowerCase().trim() as GameType;
  
  if (type === 'horizontal') winning = checkHorizontalWin(card);
  else if (type === 'vertical') winning = checkVerticalWin(card);
  else if (type === 'diagonal') winning = checkDiagonalWin(card);
  else if (type === 'full') winning = checkFullCardWin(card);
  
  if (!winning) return null;
  return { cardId: card.id, cardName: card.name, type, winningNumbers: winning };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { matchId, specificNumber } = await req.json();
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Lock
    const { data: gotLock } = await supabaseAdmin.rpc('try_lock_match', { p_match_id: matchId });
    if (!gotLock) return new Response(JSON.stringify({ success: true, message: 'Match busy' }), { headers: corsHeaders });

    // 2. Buscar Partida
    const { data: match, error: matchErr } = await supabaseAdmin.from('partidas').select('*').eq('id', matchId).single();
    if (matchErr || !match) throw new Error("Partida não encontrada");
    if (match.status === 'finished') return new Response(JSON.stringify({ success: true, message: 'Match finished' }), { headers: corsHeaders });

    // 3. Sortear número
    const calledArray = match.called_numbers || [];
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !calledArray.includes(n));

    if (availableNumbers.length === 0) {
      await supabaseAdmin.from('partidas').update({ status: 'finished', is_auto_calling: false }).eq('id', matchId);
      return new Response(JSON.stringify({ success: true, message: 'No numbers left' }), { headers: corsHeaders });
    }

    const num = (specificNumber && availableNumbers.includes(specificNumber))
      ? specificNumber
      : availableNumbers[Math.floor(Math.random() * availableNumbers.length)];

    // 4. Registrar número no banco
    const { data: appendResult } = await supabaseAdmin.rpc('append_called_number', { p_match_id: matchId, p_num: num });
    if (!appendResult || appendResult.already_called) {
       return new Response(JSON.stringify({ success: true, message: 'Number already processed' }), { headers: corsHeaders });
    }
    await supabaseAdmin.rpc('mark_number_for_match_cards', { p_match_id: matchId, p_num: num });

    // 5. Analisar Vencedores
    const { data: matchCards } = await supabaseAdmin.from('cartelas_partida').select('*').eq('match_id', matchId);
    const { data: allProfiles } = await supabaseAdmin.from('perfis').select('id, full_name');
    
    const existingWinnerCardIds = new Set((match.winners || []).map((w: any) => w.cardId));
    const newWinnersFound: any[] = [];

    for (const card of (matchCards || [])) {
      if (existingWinnerCardIds.has(card.id)) continue;

      const grid: number[][] = (card.numbers as any).map((row: any) => row.map(Number));
      const tempCard: BingoCard = {
        id: card.id,
        name: card.name,
        numbers: grid,
        markedNumbers: new Set(card.marked_numbers as number[])
      };

      const winResult = checkWin(tempCard, match.game_type);
      if (winResult) {
        newWinnersFound.push({
          playerId: card.player_id,
          playerName: allProfiles?.find(p => p.id === card.player_id)?.full_name || 'Jogador',
          cardId: card.id,
          cardName: card.name,
          creditType: card.credit_type,
          playerCardId: card.player_card_id,
          numbers: grid,
          markedNumbers: card.marked_numbers
        });
      }
    }

    // 6. Processar Conclusão
    let matchUpdate: any = {};
    const updatedWinners = [...(match.winners || []), ...newWinnersFound];

    if (newWinnersFound.length > 0) {
      const realWinners = newWinnersFound.filter(w => w.creditType === 'real');
      
      if (realWinners.length > 0) {
        // MATCH ACABOU! Atualiza IMEDIATAMENTE para evitar que a partida continue aberta
        matchUpdate = { 
          status: 'finished', 
          winners: updatedWinners, 
          is_auto_calling: false, 
          next_auto_call_timestamp: null
        };
        const { error: updateError } = await supabaseAdmin.from('partidas').update(matchUpdate).eq('id', matchId);
        
        if (!updateError) {
            // Se a partida foi finalizada com sucesso, distribui os prêmios
            const safePot = Number(match.pot) || 0;
            const prizeValConf = Number(match.prize?.value) || 0;
            const prizeValue = match.prize?.type === 'fixed' ? prizeValConf : (safePot * prizeValConf) / 100;
            
            const adminProfit = Math.max(0, safePot - prizeValue);
            const prizePerWinner = prizeValue / realWinners.length;

            if (adminProfit > 0) {
              await supabaseAdmin.rpc('increment_admin_profit', { amount: adminProfit }).catch(() => {});
            }

            for (const rw of realWinners) {
              if (prizePerWinner > 0) {
                await supabaseAdmin.rpc('increment_player_credits', { p_player_id: rw.playerId, p_amount: prizePerWinner }).catch(() => {});
              }
            }
        } else {
            console.error("[call-number] Erro CRÍTICO ao finalizar partida:", updateError.message);
        }

      } else {
        // Vitória apenas de cartelas "brincar". Verifica se o jogo deve continuar.
        const hasRemainingReal = (matchCards || []).some(c => c.credit_type === 'real' && !updatedWinners.some(w => w.cardId === c.id));
        
        if (hasRemainingReal) {
          matchUpdate = { winners: updatedWinners };
          if (match.is_auto_calling) {
            const { data: cfg } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
            const next = new Date(Date.now() + (Number(cfg?.intervalo_sorteio_auto_seg || 120) * 1000)).toISOString();
            matchUpdate.next_auto_call_timestamp = next;
          }
        } else {
          matchUpdate = { status: 'finished', winners: updatedWinners, is_auto_calling: false, next_auto_call_timestamp: null };
        }
        await supabaseAdmin.from('partidas').update(matchUpdate).eq('id', matchId);
      }

      // Registra os troféus
      for (const w of newWinnersFound) {
        await supabaseAdmin.rpc('record_winner', {
          p_match_id: matchId,
          p_player_id: w.playerId,
          p_player_card_id: w.playerCardId,
          p_match_card_id: w.cardId,
          p_prize_details: match.prize
        }).catch(() => {});
      }

    } else if (match.is_auto_calling) {
      // Ninguém ganhou, programa o próximo sorteio
      const { data: cfg } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
      const next = new Date(Date.now() + (Number(cfg?.intervalo_sorteio_auto_seg || 120) * 1000)).toISOString();
      await supabaseAdmin.from('partidas').update({ next_auto_call_timestamp: next }).eq('id', matchId);
    }

    return new Response(JSON.stringify({ success: true, newWinners: newWinnersFound.length }), { headers: corsHeaders });

  } catch (error: any) {
    console.error("[call-number] Erro fatal:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})
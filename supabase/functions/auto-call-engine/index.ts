import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const loopEnd = Date.now() + 55000; // Run for 55 seconds
    console.log("[auto-call-engine] Iniciando ciclo de processamento de partidas...");

    while (Date.now() < loopEnd) {
      const nowIso = new Date().toISOString();

      // --- 1. PROCESSAR PARTIDAS AUTOMÁTICAS ABERTAS E ATRASADAS ---
      const { data: overdueMatches, error: overdueError } = await supabaseAdmin
        .from('partidas')
        .select('*')
        .eq('status', 'open')
        .lte('start_time', nowIso)
        .like('name', 'Bingo Automático%'); // <-- SÓ OLHA PARTIDAS AUTOMÁTICAS

      if (overdueError) {
        console.error("[auto-call-engine] Erro ao buscar partidas atrasadas:", overdueError.message);
        continue;
      }

      for (const match of overdueMatches || []) {
        const { count, error: countError } = await supabaseAdmin
          .from('cartelas_partida')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', match.id);

        if (countError) {
          console.error(`[auto-call-engine] Erro ao contar jogadores para partida ${match.id}:`, countError.message);
          continue;
        }

        if ((count || 0) === 0) {
          console.log(`[auto-call-engine] Deletando partida automática vazia e atrasada: ${match.name} (ID: ${match.id})`);
          await supabaseAdmin.from('partidas').delete().eq('id', match.id);
        } else {
          console.log(`[auto-call-engine] Iniciando partida com ${count} jogadores: ${match.name}`);
          const { data: cfg } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
          const nextCall = new Date(Date.now() + (Number(cfg?.intervalo_sorteio_auto_seg || 10) * 1000)).toISOString();
          
          await supabaseAdmin.from('partidas').update({ 
            status: 'in_progress', 
            next_auto_call_timestamp: nextCall 
          }).eq('id', match.id);
        }
      }

      // --- 2. PROCESSAR SORTEIOS DE NÚMEROS ---
      const { data: toCall, error: toCallError } = await supabaseAdmin
        .from('partidas')
        .select('id')
        .eq('status', 'in_progress')
        .eq('is_auto_calling', true)
        .lte('next_auto_call_timestamp', nowIso);
      
      if (toCallError) {
        console.error("[auto-call-engine] Erro ao buscar partidas para sorteio:", toCallError.message);
        continue;
      }

      for (const match of toCall || []) {
        supabaseAdmin.functions.invoke('call-number', { 
          body: { matchId: match.id }
        }).catch(err => console.error(`[auto-call-engine] Erro ao invocar call-number para ${match.id}:`, err.message));
      }

      // --- 3. GARANTIR QUE O LOBBY NUNCA FIQUE VAZIO (DE PARTIDAS AUTOMÁTICAS) ---
      const { count: openOrWaitingAutoCount } = await supabaseAdmin
        .from('partidas')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'waiting'])
        .like('name', 'Bingo Automático%'); // <-- CORREÇÃO CRÍTICA AQUI

      if ((openOrWaitingAutoCount || 0) === 0) {
        const { data: settings } = await supabaseAdmin.from('configuracoes').select('*').single();
        
        if (settings?.auto_engine_enabled) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const { data: todayMatches } = await supabaseAdmin.from('partidas').select('name').gte('created_at', today.toISOString());
            
            let nextNumber = 1;
            if (todayMatches && todayMatches.length > 0) {
              const numbers = todayMatches.map(m => {
                  const match = m.name.match(/#(\d+)/);
                  return match ? parseInt(match[1], 10) : 0;
                }).filter(n => n > 0);
              if (numbers.length > 0) nextNumber = Math.max(...numbers) + 1;
              else nextNumber = todayMatches.length + 1;
            }

            if (nextNumber <= settings.auto_engine_matches_per_day) {
                const nextStart = new Date(Date.now() + 30000).toISOString(); // Próxima em 30 segundos
                const newMatch = {
                  name: `Bingo Automático #${nextNumber}`,
                  game_type: settings.auto_engine_game_type,
                  max_cards_per_player: 100,
                  card_price: settings.auto_engine_card_price,
                  prize: { type: settings.auto_engine_prize_type, value: settings.auto_engine_prize_value },
                  start_time: nextStart,
                  status: 'open',
                  is_auto_calling: true,
                  min_players: 1
                };
                await supabaseAdmin.from('partidas').insert([newMatch]);
                console.log(`[auto-call-engine] Garantia: Criada nova partida ${newMatch.name}`);
            }
        }
      }

      await sleep(1000); // Verifica a cada segundo
    }

    return new Response(JSON.stringify({ success: true, message: "Ciclo concluído." }), { headers: corsHeaders });

  } catch (error: any) {
    console.error("[auto-call-engine] Erro fatal no ciclo:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})
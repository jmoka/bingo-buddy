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

    const loopEnd = Date.now() + 55000;
    while (Date.now() < loopEnd) {
      const now = new Date();
      const nowIso = now.toISOString();

      // 1. BUSCAR PARTIDAS QUE JÁ DEVERIAM TER COMEÇADO
      const { data: overdue } = await supabaseAdmin
        .from('partidas')
        .select('*')
        .eq('status', 'open')
        .lte('start_time', nowIso);

      for (const m of overdue || []) {
        const { count } = await supabaseAdmin
          .from('cartelas_partida')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', m.id);

        const playersCount = count || 0;

        if (playersCount === 0) {
          // CARÊNCIA: Só deleta se já passou mais de 1 minuto do horário de início e continua vazia
          const startTime = new Date(m.start_time).getTime();
          const oneMinutePast = startTime + 60000;
          
          if (Date.now() > oneMinutePast) {
            console.log(`[auto-call-engine] Removendo partida vazia após carência: ${m.name}`);
            await supabaseAdmin.from('partidas').delete().eq('id', m.id);
          }
          continue;
        }

        // SE TEM JOGADORES: INICIA IMEDIATAMENTE
        const { data: cfg } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
        const interval = Number(cfg?.intervalo_sorteio_auto_seg || 10);
        const nextCall = new Date(Date.now() + (interval * 1000)).toISOString();

        console.log(`[auto-call-engine] Iniciando partida com ${playersCount} jogadores: ${m.name}`);
        await supabaseAdmin.from('partidas').update({ 
          status: 'in_progress', 
          next_auto_call_timestamp: nextCall 
        }).eq('id', m.id);
      }

      // 2. SORTEIO AUTOMÁTICO
      const { data: toCall } = await supabaseAdmin
        .from('partidas')
        .select('id')
        .eq('status', 'in_progress')
        .eq('is_auto_calling', true)
        .lte('next_auto_call_timestamp', nowIso);

      for (const m of toCall || []) {
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/call-number`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ matchId: m.id })
        }).catch(() => {});
      }

      // 3. GARANTIA DE PARTIDA NO LOBBY
      const { count: openCount } = await supabaseAdmin
        .from('partidas')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'waiting']);

      if ((openCount || 0) === 0) {
        const { data: settings } = await supabaseAdmin.from('configuracoes').select('*').single();
        if (settings?.auto_engine_enabled) {
            const nextStart = new Date(Date.now() + 30000).toISOString(); // Cria uma para daqui a 30 segundos
            await supabaseAdmin.from('partidas').insert([{
              name: "Bingo Automático #1",
              game_type: settings.auto_engine_game_type || "full",
              card_price: settings.auto_engine_card_price || 10,
              min_players: 1,
              prize: { type: settings.auto_engine_prize_type || "percentage", value: settings.auto_engine_prize_value || 95 },
              start_time: nextStart,
              status: 'open',
              is_auto_calling: true
            }]);
        }
      }

      await sleep(1000);
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})
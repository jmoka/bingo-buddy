import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Roda em loop por 55 segundos (cron dispara a cada 60s)
    const loopEnd = Date.now() + 55000;
    let totalStarted = 0;
    let totalCalled = 0;

    while (Date.now() < loopEnd) {
      const nowIso = new Date().toISOString();

      // 1. Auto-start: partidas abertas com start_time vencido
      const { data: matchesToStart } = await supabaseAdmin
        .from('partidas')
        .select('id, name')
        .eq('status', 'open')
        .eq('is_auto_calling', true)
        .lte('start_time', nowIso);

      for (const match of matchesToStart || []) {
        const { data: cards } = await supabaseAdmin
          .from('cartelas_partida')
          .select('player_id')
          .eq('match_id', match.id);

        const playerCount = new Set((cards || []).map((c: { player_id: string }) => c.player_id)).size;

        if (playerCount < 1) {
          await supabaseAdmin.from('partidas').delete().eq('id', match.id);
          console.log(`[auto-call-engine] Partida ${match.name} deletada (sem jogadores).`);
          continue;
        }

        const { data: settings } = await supabaseAdmin
          .from('configuracoes')
          .select('intervalo_sorteio_auto_seg')
          .single();

        const intervalMs = ((settings as { intervalo_sorteio_auto_seg: number } | null)?.intervalo_sorteio_auto_seg || 120) * 1000;
        const nextCall = new Date(Date.now() + intervalMs).toISOString();

        await supabaseAdmin
          .from('partidas')
          .update({ status: 'in_progress', next_auto_call_timestamp: nextCall })
          .eq('id', match.id);

        console.log(`[auto-call-engine] Partida ${match.name} iniciada.`);
        totalStarted++;
      }

      // 2. Auto-call: partidas com next_auto_call_timestamp vencido
      const { data: matchesToCall } = await supabaseAdmin
        .from('partidas')
        .select('id, name, next_auto_call_timestamp')
        .eq('status', 'in_progress')
        .eq('is_auto_calling', true)
        .lte('next_auto_call_timestamp', nowIso)
        .not('next_auto_call_timestamp', 'is', null);

      if (matchesToCall && matchesToCall.length > 0) {
        await Promise.all(
          matchesToCall.map(async (match: { id: string; name: string }) => {
            try {
              const res = await fetch(`${supabaseUrl}/functions/v1/call-number`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({ matchId: match.id }),
              });
              await res.json();
              console.log(`[auto-call-engine] Número chamado: ${match.name}`);
              totalCalled++;
            } catch (e: unknown) {
              console.error(`[auto-call-engine] Erro: ${match.name}`, e);
            }
          })
        );
      }

      // Aguarda 200ms antes do próximo ciclo
      await sleep(200);
    }

    return new Response(JSON.stringify({ started: totalStarted, called: totalCalled }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[auto-call-engine] Erro:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})

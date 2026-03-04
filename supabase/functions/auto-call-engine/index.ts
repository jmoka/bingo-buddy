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

    const loopEnd = Date.now() + 50000; // Roda por 50s
    console.log("[auto-call-engine] Iniciando ciclo de monitoramento...");

    while (Date.now() < loopEnd) {
      const nowIso = new Date().toISOString();

      // 1. AUTO-START: Partidas abertas que atingiram o horário
      const { data: toStart } = await supabaseAdmin
        .from('partidas')
        .select('id, name, start_time')
        .eq('status', 'open')
        .eq('is_auto_calling', true)
        .lte('start_time', nowIso);

      for (const m of toStart || []) {
        const { count } = await supabaseAdmin
          .from('cartelas_partida')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', m.id);

        if ((count || 0) === 0) {
          // Se não tem ninguém, espera mais 2 minutos antes de deletar (margem de segurança)
          const gracePeriod = new Date(new Date(m.start_time).getTime() + 120000).toISOString();
          if (nowIso > gracePeriod) {
            await supabaseAdmin.from('partidas').delete().eq('id', m.id);
            console.log(`[auto-call-engine] Partida vazia deletada: ${m.name}`);
          }
          continue;
        }

        const { data: cfg } = await supabaseAdmin.from('configuracoes').select('intervalo_sorteio_auto_seg').single();
        const next = new Date(Date.now() + (Number(cfg?.intervalo_sorteio_auto_seg || 120) * 1000)).toISOString();

        await supabaseAdmin.from('partidas').update({ 
          status: 'in_progress', 
          next_auto_call_timestamp: next 
        }).eq('id', m.id);
        
        console.log(`[auto-call-engine] Partida iniciada: ${m.name}`);
      }

      // 2. AUTO-CALL: Partidas em andamento que precisam de novo número
      const { data: toCall } = await supabaseAdmin
        .from('partidas')
        .select('id, name')
        .eq('status', 'in_progress')
        .eq('is_auto_calling', true)
        .lte('next_auto_call_timestamp', nowIso);

      for (const m of toCall || []) {
        console.log(`[auto-call-engine] Solicitando número para: ${m.name}`);
        // Chamada interna para a função de sorteio
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/call-number`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ matchId: m.id })
        }).catch(e => console.error(`[auto-call-engine] Erro ao chamar call-number para ${m.name}:`, e.message));
      }

      await sleep(1000); // Verifica a cada segundo
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (error: any) {
    console.error("[auto-call-engine] Erro:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})
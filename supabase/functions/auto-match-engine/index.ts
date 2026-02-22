import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { force = false } = await req.json().catch(() => ({}));
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('configuracoes')
      .select('*')
      .single();

    if (settingsError || !settings) throw new Error("Configurações não encontradas.");

    if (!settings.auto_engine_enabled && !force) {
      return new Response(JSON.stringify({ message: "Motor desativado." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Verificar limite diário
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin.from('partidas').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());

    if (count !== null && count >= settings.auto_engine_matches_per_day) {
      return new Response(JSON.stringify({ message: "Limite diário atingido." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Lógica de Slots Fixos (Alinhamento com o Relógio)
    const now = new Date();
    const startHour = settings.auto_engine_start_hour || 0;
    const interval = settings.auto_engine_interval_mins || 60;
    
    // Referência: Início do dia + Hora de Início configurada
    const reference = new Date();
    reference.setHours(startHour, 0, 0, 0);
    
    // Encontra o próximo slot disponível
    // Reduzi a margem para 10 segundos para garantir que o próximo slot seja pego mesmo logo após o início da anterior
    let nextSlot = reference.getTime();
    while (nextSlot <= now.getTime() + (10 * 1000)) { 
      nextSlot += interval * 60 * 1000;
    }

    const nextStartTime = new Date(nextSlot);

    // Verificar se já existe uma partida agendada para este slot específico
    const { data: existing } = await supabaseAdmin
      .from('partidas')
      .select('id')
      .eq('start_time', nextStartTime.toISOString())
      .in('status', ['open', 'in_progress', 'waiting'])
      .limit(1);

    if (existing && existing.length > 0 && !force) {
      return new Response(JSON.stringify({ message: "Slot já ocupado para este horário." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const newMatch = {
      name: `Bingo Automático #${(count || 0) + 1}`,
      game_type: settings.auto_engine_game_type,
      max_cards_per_player: 3,
      card_price: settings.auto_engine_card_price,
      prize: { type: settings.auto_engine_prize_type, value: settings.auto_engine_prize_value },
      start_time: nextStartTime.toISOString(),
      status: 'open',
      is_auto_calling: true,
      min_players: settings.auto_engine_prize_type === 'fixed' ? Math.ceil(settings.auto_engine_prize_value / settings.auto_engine_card_price) : 1
    };

    const { data: created, error: createError } = await supabaseAdmin.from('partidas').insert(newMatch).select().single();
    if (createError) throw createError;

    return new Response(JSON.stringify({ success: true, match: created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { format } from "https://deno.land/std@0.208.0/datetime/format.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('configuracoes')
      .select('*')
      .single();

    if (settingsError || !settings) throw new Error("Configurações não encontradas.");

    if (!settings.auto_engine_enabled) {
      return new Response(JSON.stringify({ success: false, message: "Motor desativado." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Calcula todos os slots de horário para o dia de hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const startHour = settings.auto_engine_start_hour || 0;
    const interval = settings.auto_engine_interval_mins || 60;
    const dailyLimit = settings.auto_engine_matches_per_day || 24;

    const requiredSlots = [];
    let nextSlotTime = new Date(today);
    nextSlotTime.setHours(startHour, 0, 0, 0);

    for (let i = 0; i < dailyLimit; i++) {
        requiredSlots.push(new Date(nextSlotTime));
        nextSlotTime.setMinutes(nextSlotTime.getMinutes() + interval);
    }

    // Busca as partidas automáticas já existentes para hoje
    const { data: existingMatches, error: fetchError } = await supabaseAdmin
      .from('partidas')
      .select('start_time')
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .eq('is_auto_calling', true);

    if (fetchError) throw fetchError;

    const existingSlots = new Set(existingMatches.map(m => new Date(m.start_time).getTime()));
    const matchesToCreate = [];

    for (const slot of requiredSlots) {
        // Só cria se o slot estiver no futuro e não existir ainda
        if (slot.getTime() > Date.now() && !existingSlots.has(slot.getTime())) {
            const newMatch = {
                name: `Auto ${format(slot, 'HH:mm')}`,
                game_type: settings.auto_engine_game_type,
                max_cards_per_player: 3,
                card_price: settings.auto_engine_card_price,
                prize: { type: settings.auto_engine_prize_type, value: settings.auto_engine_prize_value },
                start_time: slot.toISOString(),
                status: 'waiting', // Cria como "Aguardando"
                is_auto_calling: true,
                min_players: settings.auto_engine_prize_type === 'fixed' ? Math.ceil(settings.auto_engine_prize_value / settings.auto_engine_card_price) : 1
            };
            matchesToCreate.push(newMatch);
        }
    }

    if (matchesToCreate.length > 0) {
        const { error: createError } = await supabaseAdmin.from('partidas').insert(matchesToCreate).select();
        if (createError) throw createError;
    }

    return new Response(JSON.stringify({ success: true, createdCount: matchesToCreate.length }), {
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
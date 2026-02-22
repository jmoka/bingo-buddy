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

    // Se não estiver forçando, verifica se o motor está habilitado
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

    // Verificar intervalo (pula se for 'force')
    if (!force) {
      const { data: lastMatch } = await supabaseAdmin.from('partidas').select('created_at').order('created_at', { ascending: false }).limit(1).single();
      if (lastMatch) {
        const diffMins = (new Date().getTime() - new Date(lastMatch.created_at).getTime()) / (1000 * 60);
        if (diffMins < settings.auto_engine_interval_mins) {
          return new Response(JSON.stringify({ message: "Intervalo não atingido.", nextIn: Math.round(settings.auto_engine_interval_mins - diffMins) }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
      }
    }

    // Criar a nova partida
    const nextStartTime = new Date();
    nextStartTime.setMinutes(nextStartTime.getMinutes() + 5);

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
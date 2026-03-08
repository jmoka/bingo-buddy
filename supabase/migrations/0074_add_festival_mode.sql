-- Adiciona suporte para múltiplas rodadas (Festival/Bingo Comunitário)
ALTER TABLE partidas ADD COLUMN IF NOT EXISTS is_festival boolean DEFAULT false;
ALTER TABLE partidas ADD COLUMN IF NOT EXISTS prizes jsonb DEFAULT '[]'::jsonb;
ALTER TABLE partidas ADD COLUMN IF NOT EXISTS current_round integer DEFAULT 0;
ALTER TABLE partidas ADD COLUMN IF NOT EXISTS completed_rounds jsonb DEFAULT '[]'::jsonb;

-- Função para avançar a rodada, limpando o globo e as cartelas, mantendo os jogadores
CREATE OR REPLACE FUNCTION public.next_festival_round(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_match partidas%ROWTYPE;
  v_new_round integer;
  v_next_prize jsonb;
  v_completed jsonb;
BEGIN
  -- Trava a linha da partida
  SELECT * INTO v_match FROM partidas WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.is_festival = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a festival match');
  END IF;

  IF v_match.status != 'finished' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current round not finished');
  END IF;

  v_new_round := v_match.current_round + 1;

  IF v_new_round >= jsonb_array_length(v_match.prizes) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No more rounds available');
  END IF;

  v_next_prize := v_match.prizes->v_new_round;
  
  -- Salva o histórico da rodada que acabou de encerrar
  v_completed := v_match.completed_rounds || jsonb_build_object(
    'round', v_match.current_round,
    'prize', v_match.prize,
    'winners', v_match.winners
  );

  -- Atualiza a partida para a próxima rodada
  UPDATE partidas 
  SET 
    current_round = v_new_round,
    prize = v_next_prize,
    called_numbers = '{}'::int[],
    winners = '[]'::jsonb,
    status = 'in_progress',
    completed_rounds = v_completed,
    is_auto_calling = false -- Pausa o automático para o locutor respirar
  WHERE id = p_match_id;

  -- Zera a marcação de todas as cartelas dessa partida (mantém apenas o 0 = espaço livre)
  UPDATE cartelas_partida
  SET marked_numbers = '{0}'::int[]
  WHERE match_id = p_match_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;
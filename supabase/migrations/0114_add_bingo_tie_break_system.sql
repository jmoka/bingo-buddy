-- 0114_add_bingo_tie_break_system.sql
-- Base de desempate para partidas de bingo com consenso por maioria.

ALTER TABLE public.partidas
  ADD COLUMN IF NOT EXISTS tie_break_status text NOT NULL DEFAULT 'none'
    CHECK (tie_break_status IN ('none', 'pending', 'resolved')),
  ADD COLUMN IF NOT EXISTS tie_break_session_id uuid NULL;

CREATE TABLE IF NOT EXISTS public.tie_break_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  admin_id uuid NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'voting' CHECK (status IN ('voting', 'random_pending', 'resolved', 'cancelled')),
  current_vote_round integer NOT NULL DEFAULT 1,
  current_random_round integer NOT NULL DEFAULT 1,
  allowed_options text[] NOT NULL DEFAULT ARRAY['random_number', 'rematch', 'split_prize']::text[],
  split_allowed boolean NOT NULL DEFAULT true,
  selected_resolution text NULL CHECK (selected_resolution IN ('random_number', 'rematch', 'split_prize')),
  resolved_by_majority boolean NOT NULL DEFAULT false,
  winner_player_id uuid NULL REFERENCES public.perfis(id) ON DELETE SET NULL,
  resolution_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.tie_break_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.tie_break_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  is_active_random boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (session_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.tie_break_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.tie_break_sessions(id) ON DELETE CASCADE,
  vote_round integer NOT NULL,
  player_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  option text NOT NULL CHECK (option IN ('random_number', 'rematch', 'split_prize')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (session_id, vote_round, player_id)
);

CREATE TABLE IF NOT EXISTS public.tie_break_random_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.tie_break_sessions(id) ON DELETE CASCADE,
  random_round integer NOT NULL,
  player_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  generated_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (session_id, random_round, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tie_break_sessions_match_id ON public.tie_break_sessions(match_id);
CREATE INDEX IF NOT EXISTS idx_tie_break_participants_session_id ON public.tie_break_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_tie_break_votes_session_round ON public.tie_break_votes(session_id, vote_round);
CREATE INDEX IF NOT EXISTS idx_tie_break_random_session_round ON public.tie_break_random_numbers(session_id, random_round);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tie_break_active_session_per_match
  ON public.tie_break_sessions(match_id)
  WHERE status IN ('voting', 'random_pending');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partidas_tie_break_session_id_fkey'
      AND conrelid = 'public.partidas'::regclass
  ) THEN
    ALTER TABLE public.partidas
      ADD CONSTRAINT partidas_tie_break_session_id_fkey
      FOREIGN KEY (tie_break_session_id)
      REFERENCES public.tie_break_sessions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.tie_break_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tie_break_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tie_break_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tie_break_random_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants can read tie sessions" ON public.tie_break_sessions;
CREATE POLICY "participants can read tie sessions"
ON public.tie_break_sessions
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.tie_break_participants p
    WHERE p.session_id = tie_break_sessions.id
      AND p.player_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "participants can read tie participants" ON public.tie_break_participants;
CREATE POLICY "participants can read tie participants"
ON public.tie_break_participants
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.tie_break_participants p2
    WHERE p2.session_id = tie_break_participants.session_id
      AND p2.player_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "participants can read tie votes" ON public.tie_break_votes;
CREATE POLICY "participants can read tie votes"
ON public.tie_break_votes
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.tie_break_participants p
    WHERE p.session_id = tie_break_votes.session_id
      AND p.player_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "participants can read tie random numbers" ON public.tie_break_random_numbers;
CREATE POLICY "participants can read tie random numbers"
ON public.tie_break_random_numbers
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.tie_break_participants p
    WHERE p.session_id = tie_break_random_numbers.session_id
      AND p.player_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.touch_tie_break_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_tie_break_sessions_updated_at ON public.tie_break_sessions;
CREATE TRIGGER trg_touch_tie_break_sessions_updated_at
BEFORE UPDATE ON public.tie_break_sessions
FOR EACH ROW
EXECUTE FUNCTION public.touch_tie_break_updated_at();

DROP TRIGGER IF EXISTS trg_touch_tie_break_votes_updated_at ON public.tie_break_votes;
CREATE TRIGGER trg_touch_tie_break_votes_updated_at
BEFORE UPDATE ON public.tie_break_votes
FOR EACH ROW
EXECUTE FUNCTION public.touch_tie_break_updated_at();

DROP TRIGGER IF EXISTS trg_touch_tie_break_random_numbers_updated_at ON public.tie_break_random_numbers;
CREATE TRIGGER trg_touch_tie_break_random_numbers_updated_at
BEFORE UPDATE ON public.tie_break_random_numbers
FOR EACH ROW
EXECUTE FUNCTION public.touch_tie_break_updated_at();

CREATE OR REPLACE FUNCTION public.create_tie_break_session(
  p_match_id uuid,
  p_player_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.partidas%ROWTYPE;
  v_session_id uuid;
  v_split_allowed boolean;
  v_allowed_options text[];
  v_ids_distinct uuid[];
  v_ids_len integer;
  v_cards_len integer;
BEGIN
  IF p_match_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_id_required');
  END IF;

  v_ids_distinct := ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(p_player_ids, ARRAY[]::uuid[])) AS x
    WHERE x IS NOT NULL
  );

  v_ids_len := COALESCE(array_length(v_ids_distinct, 1), 0);
  IF v_ids_len < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'need_at_least_two_players');
  END IF;

  SELECT *
    INTO v_match
  FROM public.partidas
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  SELECT COUNT(DISTINCT cp.player_id)
    INTO v_cards_len
  FROM public.cartelas_partida cp
  WHERE cp.match_id = p_match_id
    AND cp.credit_type = 'real'
    AND cp.player_id = ANY(v_ids_distinct);

  IF v_cards_len <> v_ids_len THEN
    RETURN jsonb_build_object('success', false, 'error', 'players_not_valid_for_match');
  END IF;

  SELECT id INTO v_session_id
  FROM public.tie_break_sessions
  WHERE match_id = p_match_id
    AND status IN ('voting', 'random_pending')
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    UPDATE public.partidas
    SET tie_break_status = 'pending', tie_break_session_id = v_session_id
    WHERE id = p_match_id;

    RETURN jsonb_build_object(
      'success', true,
      'sessionId', v_session_id,
      'alreadyExists', true
    );
  END IF;

  v_split_allowed := COALESCE(v_match.prize->>'type', '') <> 'product';

  IF v_split_allowed THEN
    v_allowed_options := ARRAY['random_number', 'rematch', 'split_prize']::text[];
  ELSE
    v_allowed_options := ARRAY['random_number', 'rematch']::text[];
  END IF;

  INSERT INTO public.tie_break_sessions (
    match_id,
    admin_id,
    status,
    allowed_options,
    split_allowed
  )
  VALUES (
    p_match_id,
    v_match.admin_id,
    'voting',
    v_allowed_options,
    v_split_allowed
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.tie_break_participants (session_id, player_id)
  SELECT v_session_id, x
  FROM unnest(v_ids_distinct) AS x;

  UPDATE public.partidas
  SET tie_break_status = 'pending', tie_break_session_id = v_session_id
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'sessionId', v_session_id,
    'splitAllowed', v_split_allowed,
    'allowedOptions', to_jsonb(v_allowed_options)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_tie_break_vote(
  p_session_id uuid,
  p_option text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_session public.tie_break_sessions%ROWTYPE;
  v_match public.partidas%ROWTYPE;
  v_round integer;
  v_total integer;
  v_voted integer;
  v_max_count integer;
  v_winner_option text;
  v_options_at_max integer;
  v_participant_ids uuid[];
  v_participant_count integer := 0;
  v_safe_pot numeric := 0;
  v_prize_value numeric := 0;
  v_total_prize_pool numeric := 0;
  v_split_each numeric := 0;
  v_player_id uuid;
  v_new_match_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT *
    INTO v_session
  FROM public.tie_break_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  IF v_session.status <> 'voting' THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_in_voting');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tie_break_participants p
    WHERE p.session_id = v_session.id
      AND p.player_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_participant');
  END IF;

  IF NOT (p_option = ANY(v_session.allowed_options)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'option_not_allowed');
  END IF;

  v_round := v_session.current_vote_round;

  INSERT INTO public.tie_break_votes (session_id, vote_round, player_id, option)
  VALUES (v_session.id, v_round, v_user_id, p_option)
  ON CONFLICT (session_id, vote_round, player_id)
  DO UPDATE SET option = EXCLUDED.option;

  SELECT COUNT(*) INTO v_total
  FROM public.tie_break_participants
  WHERE session_id = v_session.id;

  SELECT COUNT(*) INTO v_voted
  FROM public.tie_break_votes
  WHERE session_id = v_session.id
    AND vote_round = v_round;

  IF v_voted < v_total THEN
    RETURN jsonb_build_object(
      'success', true,
      'round', v_round,
      'waitingForVotes', true,
      'votedCount', v_voted,
      'totalParticipants', v_total
    );
  END IF;

  SELECT t.option, t.cnt
    INTO v_winner_option, v_max_count
  FROM (
    SELECT option, COUNT(*) AS cnt
    FROM public.tie_break_votes
    WHERE session_id = v_session.id
      AND vote_round = v_round
    GROUP BY option
    ORDER BY cnt DESC, option ASC
    LIMIT 1
  ) t;

  SELECT COUNT(*) INTO v_options_at_max
  FROM (
    SELECT option, COUNT(*) AS cnt
    FROM public.tie_break_votes
    WHERE session_id = v_session.id
      AND vote_round = v_round
    GROUP BY option
  ) c
  WHERE c.cnt = v_max_count;

  IF v_options_at_max = 1 THEN
    UPDATE public.tie_break_sessions
    SET selected_resolution = v_winner_option,
        resolved_by_majority = true,
        status = CASE WHEN v_winner_option = 'random_number' THEN 'random_pending' ELSE 'resolved' END,
        resolution_payload = jsonb_build_object(
          'decisionRound', v_round,
          'majorityOption', v_winner_option,
          'voteCount', v_max_count
        )
    WHERE id = v_session.id;

    IF v_winner_option = 'split_prize' THEN
      SELECT *
        INTO v_match
      FROM public.partidas
      WHERE id = v_session.match_id
      FOR UPDATE;

      SELECT ARRAY_AGG(player_id), COUNT(*)
        INTO v_participant_ids, v_participant_count
      FROM public.tie_break_participants
      WHERE session_id = v_session.id;

      v_safe_pot := COALESCE(v_match.pot, 0);
      v_prize_value := COALESCE((v_match.prize->>'value')::numeric, 0);

      IF v_match.prize->>'type' = 'fixed' THEN
        v_total_prize_pool := v_prize_value;
      ELSIF v_match.prize->>'type' = 'percentage' THEN
        v_total_prize_pool := (v_safe_pot * v_prize_value) / 100;
      ELSE
        v_total_prize_pool := 0;
      END IF;

      IF v_participant_count > 0 THEN
        v_split_each := v_total_prize_pool / v_participant_count;
      END IF;

      IF v_split_each > 0 AND v_participant_ids IS NOT NULL THEN
        FOREACH v_player_id IN ARRAY v_participant_ids LOOP
          PERFORM public.increment_player_credits(
            p_player_id => v_player_id,
            p_amount => v_split_each
          );
        END LOOP;
      END IF;

      UPDATE public.tie_break_sessions
      SET resolution_payload = COALESCE(resolution_payload, '{}'::jsonb) || jsonb_build_object(
        'payoutApplied', true,
        'paidAmount', v_total_prize_pool,
        'splitPerPlayer', v_split_each,
        'splitPlayerCount', v_participant_count
      )
      WHERE id = v_session.id;

      UPDATE public.partidas
      SET status = 'finished',
          tie_break_status = 'resolved',
          is_auto_calling = false,
          next_auto_call_timestamp = null
      WHERE id = v_session.match_id;
    ELSIF v_winner_option = 'rematch' THEN
      SELECT *
        INTO v_match
      FROM public.partidas
      WHERE id = v_session.match_id
      FOR UPDATE;

      SELECT COUNT(*)
        INTO v_participant_count
      FROM public.tie_break_participants
      WHERE session_id = v_session.id;

      INSERT INTO public.partidas (
        name,
        game_type,
        max_cards_per_player,
        card_price,
        prize,
        start_time,
        status,
        called_numbers,
        pot,
        winners,
        is_auto_calling,
        next_auto_call_timestamp,
        min_players,
        admin_id,
        is_festival,
        prizes,
        current_round,
        completed_rounds,
        tie_break_status,
        tie_break_session_id
      )
      VALUES (
        COALESCE(v_match.name, 'Partida') || ' - Rematch',
        v_match.game_type,
        GREATEST(1, COALESCE(v_participant_count, 1)),
        0,
        v_match.prize,
        timezone('utc'::text, now()),
        'in_progress',
        '{}'::integer[],
        v_match.pot,
        '[]'::jsonb,
        false,
        null,
        GREATEST(1, COALESCE(v_participant_count, 1)),
        v_match.admin_id,
        false,
        '[]'::jsonb,
        0,
        '[]'::jsonb,
        'none',
        null
      )
      RETURNING id INTO v_new_match_id;

      INSERT INTO public.cartelas_partida (
        player_card_id,
        player_id,
        match_id,
        name,
        numbers,
        marked_numbers
      )
      SELECT
        cp.player_card_id,
        cp.player_id,
        v_new_match_id,
        cp.name,
        cp.numbers,
        '{}'::integer[]
      FROM public.cartelas_partida cp
      JOIN (
        SELECT DISTINCT (w->>'cardId')::uuid AS card_id
        FROM jsonb_array_elements(COALESCE(v_match.winners, '[]'::jsonb)) AS w
        WHERE COALESCE(w->>'creditType', 'real') = 'real'
      ) tied_cards
        ON tied_cards.card_id = cp.id
      WHERE cp.match_id = v_match.id;

      UPDATE public.tie_break_sessions
      SET resolution_payload = COALESCE(resolution_payload, '{}'::jsonb) || jsonb_build_object(
        'rematchMatchId', v_new_match_id
      )
      WHERE id = v_session.id;

      UPDATE public.partidas
      SET status = 'finished',
          tie_break_status = 'resolved',
          is_auto_calling = false,
          next_auto_call_timestamp = null
      WHERE id = v_session.match_id;
    ELSIF v_winner_option <> 'random_number' THEN
      UPDATE public.partidas
      SET tie_break_status = 'resolved'
      WHERE id = v_session.match_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'round', v_round,
      'consensusReached', true,
      'selectedResolution', v_winner_option,
      'voteCount', v_max_count
    );
  END IF;

  UPDATE public.tie_break_sessions
  SET current_vote_round = current_vote_round + 1,
      status = 'voting',
      selected_resolution = NULL,
      resolved_by_majority = false
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'success', true,
    'round', v_round,
    'consensusReached', false,
    'needsRevote', true,
    'message', 'Nao houve consenso. Escolham novamente.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_tie_break_random_number(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_session public.tie_break_sessions%ROWTYPE;
  v_match public.partidas%ROWTYPE;
  v_round integer;
  v_total_active integer;
  v_submitted integer;
  v_generated integer;
  v_highest integer;
  v_highest_count integer;
  v_winner uuid;
  v_tied_ids uuid[];
  v_safe_pot numeric := 0;
  v_prize_value numeric := 0;
  v_total_prize_pool numeric := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT *
    INTO v_session
  FROM public.tie_break_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  IF v_session.status <> 'random_pending' OR v_session.selected_resolution <> 'random_number' THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_ready_for_random');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tie_break_participants p
    WHERE p.session_id = v_session.id
      AND p.player_id = v_user_id
      AND p.is_active_random = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'player_not_active_for_random_round');
  END IF;

  v_round := v_session.current_random_round;
  v_generated := (floor(random() * 999999) + 1)::integer;

  INSERT INTO public.tie_break_random_numbers (session_id, random_round, player_id, generated_number)
  VALUES (v_session.id, v_round, v_user_id, v_generated)
  ON CONFLICT (session_id, random_round, player_id)
  DO UPDATE SET generated_number = EXCLUDED.generated_number;

  SELECT COUNT(*) INTO v_total_active
  FROM public.tie_break_participants
  WHERE session_id = v_session.id
    AND is_active_random = true;

  SELECT COUNT(*) INTO v_submitted
  FROM public.tie_break_random_numbers rn
  JOIN public.tie_break_participants p
    ON p.session_id = rn.session_id
   AND p.player_id = rn.player_id
  WHERE rn.session_id = v_session.id
    AND rn.random_round = v_round
    AND p.is_active_random = true;

  IF v_submitted < v_total_active THEN
    RETURN jsonb_build_object(
      'success', true,
      'round', v_round,
      'generatedNumber', v_generated,
      'waitingForNumbers', true,
      'submittedCount', v_submitted,
      'totalActiveParticipants', v_total_active
    );
  END IF;

  SELECT MAX(generated_number) INTO v_highest
  FROM public.tie_break_random_numbers rn
  JOIN public.tie_break_participants p
    ON p.session_id = rn.session_id
   AND p.player_id = rn.player_id
  WHERE rn.session_id = v_session.id
    AND rn.random_round = v_round
    AND p.is_active_random = true;

  SELECT COUNT(*) INTO v_highest_count
  FROM public.tie_break_random_numbers rn
  JOIN public.tie_break_participants p
    ON p.session_id = rn.session_id
   AND p.player_id = rn.player_id
  WHERE rn.session_id = v_session.id
    AND rn.random_round = v_round
    AND rn.generated_number = v_highest
    AND p.is_active_random = true;

  IF v_highest_count = 1 THEN
    SELECT rn.player_id INTO v_winner
    FROM public.tie_break_random_numbers rn
    JOIN public.tie_break_participants p
      ON p.session_id = rn.session_id
     AND p.player_id = rn.player_id
    WHERE rn.session_id = v_session.id
      AND rn.random_round = v_round
      AND rn.generated_number = v_highest
      AND p.is_active_random = true
    LIMIT 1;

    UPDATE public.tie_break_sessions
    SET status = 'resolved',
        winner_player_id = v_winner,
        resolution_payload = COALESCE(resolution_payload, '{}'::jsonb) || jsonb_build_object(
          'randomRoundResolved', v_round,
          'winningNumber', v_highest,
          'winnerPlayerId', v_winner
        )
    WHERE id = v_session.id;

    UPDATE public.partidas
    SET status = 'finished',
        tie_break_status = 'resolved',
        is_auto_calling = false,
        next_auto_call_timestamp = null
    WHERE id = v_session.match_id;

    SELECT *
      INTO v_match
    FROM public.partidas
    WHERE id = v_session.match_id;

    v_safe_pot := COALESCE(v_match.pot, 0);
    v_prize_value := COALESCE((v_match.prize->>'value')::numeric, 0);

    IF v_match.prize->>'type' = 'fixed' THEN
      v_total_prize_pool := v_prize_value;
    ELSIF v_match.prize->>'type' = 'percentage' THEN
      v_total_prize_pool := (v_safe_pot * v_prize_value) / 100;
    ELSE
      v_total_prize_pool := 0;
    END IF;

    IF v_total_prize_pool > 0 THEN
      PERFORM public.increment_player_credits(
        p_player_id => v_winner,
        p_amount => v_total_prize_pool
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'round', v_round,
      'resolved', true,
      'winnerPlayerId', v_winner,
      'winningNumber', v_highest,
      'paidAmount', v_total_prize_pool
    );
  END IF;

  SELECT ARRAY_AGG(rn.player_id)
    INTO v_tied_ids
  FROM public.tie_break_random_numbers rn
  JOIN public.tie_break_participants p
    ON p.session_id = rn.session_id
   AND p.player_id = rn.player_id
  WHERE rn.session_id = v_session.id
    AND rn.random_round = v_round
    AND rn.generated_number = v_highest
    AND p.is_active_random = true;

  UPDATE public.tie_break_participants
  SET is_active_random = (player_id = ANY(v_tied_ids))
  WHERE session_id = v_session.id;

  UPDATE public.tie_break_sessions
  SET current_random_round = current_random_round + 1,
      status = 'random_pending'
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'success', true,
    'round', v_round,
    'resolved', false,
    'needsAnotherRandomRound', true,
    'tiedPlayerIds', COALESCE(to_jsonb(v_tied_ids), '[]'::jsonb),
    'highestNumber', v_highest
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tie_break_session_state(
  p_match_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.tie_break_sessions%ROWTYPE;
BEGIN
  SELECT s.* INTO v_session
  FROM public.tie_break_sessions s
  WHERE s.match_id = p_match_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'found', false);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'found', true,
    'session', to_jsonb(v_session),
    'participants', COALESCE((
      SELECT jsonb_agg(to_jsonb(p))
      FROM public.tie_break_participants p
      WHERE p.session_id = v_session.id
    ), '[]'::jsonb),
    'votesCurrentRound', COALESCE((
      SELECT jsonb_agg(to_jsonb(v))
      FROM public.tie_break_votes v
      WHERE v.session_id = v_session.id
        AND v.vote_round = v_session.current_vote_round
    ), '[]'::jsonb),
    'randomCurrentRound', COALESCE((
      SELECT jsonb_agg(to_jsonb(rn))
      FROM public.tie_break_random_numbers rn
      WHERE rn.session_id = v_session.id
        AND rn.random_round = v_session.current_random_round
    ), '[]'::jsonb),
    'randomAllEntries', COALESCE((
      SELECT jsonb_agg(to_jsonb(rn) ORDER BY rn.random_round, rn.generated_number DESC)
      FROM public.tie_break_random_numbers rn
      WHERE rn.session_id = v_session.id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_tie_break_resolution(
  p_match_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.partidas%ROWTYPE;
  v_session public.tie_break_sessions%ROWTYPE;
  v_winner uuid;
  v_safe_pot numeric := 0;
  v_prize_value numeric := 0;
  v_total_prize_pool numeric := 0;
  v_payout_applied boolean := false;
BEGIN
  SELECT * INTO v_match
  FROM public.partidas
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  SELECT * INTO v_session
  FROM public.tie_break_sessions
  WHERE match_id = p_match_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR v_session.status <> 'resolved' OR v_session.winner_player_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'resolved_session_not_found');
  END IF;

  v_winner := v_session.winner_player_id;
  v_payout_applied := COALESCE((v_session.resolution_payload->>'payoutApplied')::boolean, false);

  UPDATE public.partidas
  SET status = 'finished',
      tie_break_status = 'resolved',
      is_auto_calling = false,
      next_auto_call_timestamp = null
  WHERE id = p_match_id;

  IF NOT v_payout_applied THEN
    v_safe_pot := COALESCE(v_match.pot, 0);
    v_prize_value := COALESCE((v_match.prize->>'value')::numeric, 0);

    IF v_match.prize->>'type' = 'fixed' THEN
      v_total_prize_pool := v_prize_value;
    ELSIF v_match.prize->>'type' = 'percentage' THEN
      v_total_prize_pool := (v_safe_pot * v_prize_value) / 100;
    ELSE
      v_total_prize_pool := 0;
    END IF;

    IF v_total_prize_pool > 0 THEN
      PERFORM public.increment_player_credits(
        p_player_id => v_winner,
        p_amount => v_total_prize_pool
      );
    END IF;

    UPDATE public.tie_break_sessions
    SET resolution_payload = COALESCE(resolution_payload, '{}'::jsonb) || jsonb_build_object(
      'payoutApplied', true,
      'paidAmount', v_total_prize_pool
    )
    WHERE id = v_session.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'matchId', p_match_id,
    'winnerPlayerId', v_winner,
    'paidAmount', COALESCE((SELECT (resolution_payload->>'paidAmount')::numeric FROM public.tie_break_sessions WHERE id = v_session.id), v_total_prize_pool)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tie_break_session(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_tie_break_vote(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_tie_break_random_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tie_break_session_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_tie_break_resolution(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

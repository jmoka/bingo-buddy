-- Function to switch a card to manual mode
CREATE OR REPLACE FUNCTION public.set_manual_mode(p_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.cartelas_partida
    SET marking_mode = 'manual'
    WHERE id = p_card_id AND player_id = auth.uid();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'card_not_found_or_unauthorized');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to toggle a number on a manual card
CREATE OR REPLACE FUNCTION public.toggle_manual_mark(p_card_id uuid, p_num integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_card public.cartelas_partida;
    v_is_marked boolean;
BEGIN
    SELECT * INTO v_card FROM public.cartelas_partida WHERE id = p_card_id AND player_id = auth.uid();
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'card_not_found_or_unauthorized');
    END IF;

    IF v_card.marking_mode != 'manual' THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_in_manual_mode');
    END IF;

    v_is_marked := (p_num = ANY(COALESCE(v_card.marked_numbers, '{}'::int[])));

    IF v_is_marked THEN
        UPDATE public.cartelas_partida SET marked_numbers = array_remove(marked_numbers, p_num) WHERE id = p_card_id;
    ELSE
        UPDATE public.cartelas_partida SET marked_numbers = array_append(COALESCE(v_card.marked_numbers, '{}'::int[]), p_num) WHERE id = p_card_id;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Drop the old complex function
DROP FUNCTION IF EXISTS public.manual_mark_number(uuid, integer);
CREATE OR REPLACE FUNCTION public.manual_mark_number(p_card_id uuid, p_num integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_called_numbers int[];
    v_match_id uuid;
BEGIN
    -- Se um número foi passado, valida se ele já foi sorteado
    IF p_num IS NOT NULL THEN
        SELECT match_id INTO v_match_id FROM cartelas_partida WHERE id = p_card_id;
        SELECT called_numbers INTO v_called_numbers FROM partidas WHERE id = v_match_id;

        IF NOT (p_num = ANY(v_called_numbers)) THEN
            RETURN jsonb_build_object('success', false, 'error', 'number_not_called');
        END IF;

        -- Altera o modo para manual e adiciona o número marcado (se não estiver marcado)
        UPDATE cartelas_partida 
        SET 
            marking_mode = 'manual',
            marked_numbers = CASE 
                                WHEN NOT (p_num = ANY(COALESCE(marked_numbers, '{}'::int[])))
                                THEN array_append(COALESCE(marked_numbers, '{}'::int[]), p_num)
                                ELSE marked_numbers
                             END
        WHERE id = p_card_id 
          AND player_id = auth.uid();
    ELSE
        -- Se nenhum número foi passado (p_num IS NULL), apenas altera o modo para manual
        UPDATE cartelas_partida 
        SET 
            marking_mode = 'manual'
        WHERE id = p_card_id 
          AND player_id = auth.uid();
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$function$
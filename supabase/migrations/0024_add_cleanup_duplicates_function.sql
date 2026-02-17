CREATE OR REPLACE FUNCTION public.cleanup_match_duplicates(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    duplicate_row record;
    total_refund_amount integer := 0;
    total_uses_restored integer := 0;
    total_cards_deleted integer := 0;
    card_price_val integer;
BEGIN
    -- Get match card price
    SELECT card_price INTO card_price_val FROM partidas WHERE id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Partida não encontrada: %', p_match_id;
    END IF;

    FOR duplicate_row IN
        WITH ranked_cards AS (
            SELECT
                id,
                player_card_id,
                player_id,
                ROW_NUMBER() OVER(PARTITION BY player_card_id ORDER BY created_at) as rn
            FROM cartelas_partida
            WHERE match_id = p_match_id
        )
        SELECT
            player_card_id,
            player_id,
            COUNT(*) - 1 as num_to_delete,
            array_agg(id) FILTER (WHERE rn > 1) as ids_to_delete
        FROM ranked_cards
        GROUP BY player_card_id, player_id
        HAVING COUNT(*) > 1
    LOOP
        -- Delete duplicate match cards
        DELETE FROM cartelas_partida WHERE id = ANY(duplicate_row.ids_to_delete);
        total_cards_deleted := total_cards_deleted + duplicate_row.num_to_delete;

        -- Restore uses to player card
        UPDATE cartelas_jogador
        SET uses_left = uses_left + duplicate_row.num_to_delete
        WHERE id = duplicate_row.player_card_id;
        total_uses_restored := total_uses_restored + duplicate_row.num_to_delete;

        -- Calculate refund and update player credits
        DECLARE
            refund_amount integer := duplicate_row.num_to_delete * card_price_val;
        BEGIN
            UPDATE perfis
            SET credits = credits + refund_amount
            WHERE id = duplicate_row.player_id;
            total_refund_amount := total_refund_amount + refund_amount;
        END;
    END LOOP;

    -- Update match pot
    UPDATE partidas
    SET pot = pot - total_refund_amount
    WHERE id = p_match_id;

    RETURN json_build_object(
        'success', true,
        'match_id', p_match_id,
        'cards_deleted', total_cards_deleted,
        'uses_restored', total_uses_restored,
        'credits_refunded', total_refund_amount
    );
END;
$function$;
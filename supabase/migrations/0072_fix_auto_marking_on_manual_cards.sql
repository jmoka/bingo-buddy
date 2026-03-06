-- Re-aplica a correção na função para garantir que ela respeite o marking_mode
-- Esta função é chamada a cada número sorteado para marcar as cartelas.
CREATE OR REPLACE FUNCTION public.mark_number_for_match_cards(p_match_id uuid, p_num integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_updated int;
begin
  update public.cartelas_partida cp
     set marked_numbers =
           array_append(coalesce(cp.marked_numbers, '{}'::int[]), p_num)
   where cp.match_id = p_match_id
     -- CORREÇÃO: APENAS cartelas que estão no modo 'auto' devem ser marcadas pelo sistema.
     and cp.marking_mode = 'auto'
     and not (p_num = any(coalesce(cp.marked_numbers, '{}'::int[])))
     and jsonb_path_exists(
           cp.numbers,
           '$.** ? (@ == $n)',
           jsonb_build_object('n', p_num)
         );

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$function$
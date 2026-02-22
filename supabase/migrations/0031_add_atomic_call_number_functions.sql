-- Adiciona um lock transacional por partida para evitar concorrência.
create or replace function public.try_lock_match(p_match_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  got_lock boolean;
begin
  -- O lock é liberado automaticamente no final da transação.
  select pg_try_advisory_xact_lock(hashtext(p_match_id::text)) into got_lock;
  return got_lock;
end;
$$;

-- Adiciona um número sorteado de forma atômica e idempotente.
create or replace function public.append_called_number(
  p_match_id uuid,
  p_num int
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_status text;
  v_called int[];
  v_already boolean;
begin
  -- Trava a linha da partida para consistência.
  select status, coalesce(called_numbers, '{}'::int[])
    into v_status, v_called
  from public.partidas
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Partida não encontrada';
  end if;

  if v_status = 'finished' then
    return jsonb_build_object(
      'status', v_status,
      'already_called', true,
      'called_numbers', v_called
    );
  end if;

  v_already := (p_num = any(v_called));

  if not v_already then
    update public.partidas
      set called_numbers = array_append(v_called, p_num)
    where id = p_match_id
    returning called_numbers into v_called;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'already_called', v_already,
    'called_numbers', v_called
  );
end;
$$;

-- Marca o número em todas as cartelas da partida de forma atômica.
create or replace function public.mark_number_for_match_cards(
  p_match_id uuid,
  p_num int
)
returns int
language plpgsql
security definer
as $$
declare
  v_updated int;
begin
  update public.cartelas_partida cp
     set marked_numbers =
           array_append(coalesce(cp.marked_numbers, '{}'::int[]), p_num)
   where cp.match_id = p_match_id
     -- Não duplicar o número no array de marcados
     and not (p_num = any(coalesce(cp.marked_numbers, '{}'::int[])))
     -- Só marca se o número existir na cartela (numbers é jsonb)
     and jsonb_path_exists(
           cp.numbers,
           '$.** ? (@ == $n)',
           jsonb_build_object('n', p_num)
         );

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- Incrementa o saldo de um jogador de forma atômica.
create or replace function public.increment_player_credits(
  p_player_id uuid,
  p_amount int
)
returns void
language plpgsql
security definer
as $$
begin
  update public.perfis
  set credits = credits + p_amount
  where id = p_player_id;
end;
$$;

-- Garante que uma vitória só possa ser registrada uma vez por cartela em uma partida.
ALTER TABLE public.vitorias ADD CONSTRAINT vitorias_match_card_unique UNIQUE (match_id, match_card_id);

-- Registra uma vitória de forma idempotente.
create or replace function public.record_winner(
  p_match_id uuid,
  p_player_id uuid,
  p_player_card_id uuid,
  p_match_card_id uuid,
  p_prize_details jsonb
)
returns void
language plpgsql
as $$
begin
  insert into public.vitorias(match_id, player_id, player_card_id, match_card_id, prize_details)
  values (p_match_id, p_player_id, p_player_card_id, p_match_card_id, p_prize_details)
  on conflict (match_id, match_card_id) do nothing;
end;
$$;
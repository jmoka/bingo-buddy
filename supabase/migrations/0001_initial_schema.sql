-- Drop existing objects with CASCADE to handle dependencies and both old/new names
DROP TABLE IF EXISTS public.match_cards CASCADE;
DROP TABLE IF EXISTS public.player_cards CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.cartelas_partida CASCADE;
DROP TABLE IF EXISTS public.cartelas_jogador CASCADE;
DROP TABLE IF EXISTS public.partidas CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.perfis CASCADE;

-- Drop trigger and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Drop types
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.prize_type CASCADE;
DROP TYPE IF EXISTS public.match_status CASCADE;

-- Recreate everything with Portuguese names and new admin logic

-- Create custom types for better data integrity
create type public.match_status as enum ('waiting', 'open', 'in_progress', 'finished');
create type public.prize_type as enum ('product', 'fixed', 'percentage');
create type public.user_role as enum ('admin', 'user');

-- Helper function to safely check if the current user is an admin
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return (select role from public.perfis where id = auth.uid()) = 'admin'::user_role;
exception
  when no_data_found then
    return false;
  when others then
    return false;
end;
$$;

-- Create Profiles Table (Perfis) to store user-specific data
create table public.perfis (
  id uuid not null references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  role user_role not null default 'user',
  credits integer not null default 100,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (id)
);
-- Enable Row Level Security for Profiles
alter table public.perfis enable row level security;
-- Policies for Profiles
create policy "Users can view their own profile" on public.perfis for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.perfis for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admins can view all profiles" on public.perfis for select using (public.is_admin());

-- Function to automatically create a profile and set the first user as admin
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_count integer;
begin
  select count(*) into user_count from public.perfis;
  insert into public.perfis (id, full_name, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    case when user_count = 0 then 'admin' else 'user' end
  );
  return new;
end;
$$;

-- Trigger to execute the function when a new user is created in auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Create Matches Table (Partidas)
create table public.partidas (
  id uuid not null default gen_random_uuid() primary key,
  name text not null,
  game_type text not null,
  max_cards_per_player integer not null default 3,
  card_price integer not null default 10,
  prize jsonb not null,
  start_time timestamp with time zone not null,
  status match_status not null default 'waiting',
  called_numbers integer[] not null default '{}',
  pot integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  is_auto_calling boolean default false,
  next_auto_call_timestamp timestamp with time zone,
  winners jsonb not null default '[]'
);
-- Enable RLS for Matches
alter table public.partidas enable row level security;
-- Policies for Matches
create policy "Authenticated users can view matches" on public.partidas for select to authenticated using (true);
create policy "Admins can create matches" on public.partidas for insert with check (public.is_admin());
create policy "Admins can update matches" on public.partidas for update using (public.is_admin());
create policy "Admins can delete matches" on public.partidas for delete using (public.is_admin());


-- Create Player Cards Table (Cartelas do Jogador)
create table public.cartelas_jogador (
  id uuid not null default gen_random_uuid() primary key,
  player_id uuid not null references auth.users on delete cascade,
  name text not null,
  numbers jsonb not null,
  uses_left integer not null default 1,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
-- Enable RLS for Player Cards
alter table public.cartelas_jogador enable row level security;
-- Policies for Player Cards
create policy "Users can manage their own cards" on public.cartelas_jogador for all using (auth.uid() = player_id);
create policy "Admins can view all player cards" on public.cartelas_jogador for select using (public.is_admin());


-- Create Match Cards Table (Cartelas da Partida)
create table public.cartelas_partida (
  id uuid not null default gen_random_uuid() primary key,
  player_card_id uuid not null references public.cartelas_jogador on delete cascade,
  player_id uuid not null references auth.users on delete cascade,
  match_id uuid not null references public.partidas on delete cascade,
  name text not null,
  numbers jsonb not null,
  marked_numbers integer[] not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now())
);
-- Enable RLS for Match Cards
alter table public.cartelas_partida enable row level security;
-- Policies for Match Cards
create policy "Users can view their own match cards" on public.cartelas_partida for select using (auth.uid() = player_id);
create policy "Users can insert their own match cards" on public.cartelas_partida for insert with check (auth.uid() = player_id);
create policy "Admins can view all match cards" on public.cartelas_partida for select using (public.is_admin());
-- Drop existing objects in reverse order of dependency to avoid errors
drop table if exists public.match_cards;
drop table if exists public.player_cards;
drop table if exists public.matches;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user;
drop table if exists public.profiles;
drop function if exists public.is_admin; -- Drop new function if it exists
drop type if exists public.user_role;
drop type if exists public.prize_type;
drop type if exists public.match_status;

-- Recreate everything with the corrected policies

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
  return (select role from public.profiles where id = auth.uid()) = 'admin'::user_role;
exception
  when no_data_found then
    return false;
  when others then
    return false;
end;
$$;

-- Create Profiles Table to store user-specific data
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  role user_role not null default 'user',
  credits integer not null default 100,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (id)
);
-- Enable Row Level Security for Profiles
alter table public.profiles enable row level security;
-- Policies for Profiles
create policy "Users can view their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admins can view all profiles" on public.profiles for select using (public.is_admin());

-- Function to automatically create a profile for a new user upon signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

-- Trigger to execute the function when a new user is created in auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Create Matches Table
create table public.matches (
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
alter table public.matches enable row level security;
-- Policies for Matches
create policy "Authenticated users can view matches" on public.matches for select to authenticated using (true);
create policy "Admins can create matches" on public.matches for insert with check (public.is_admin());
create policy "Admins can update matches" on public.matches for update using (public.is_admin());
create policy "Admins can delete matches" on public.matches for delete using (public.is_admin());


-- Create Player Cards Table (templates owned by players)
create table public.player_cards (
  id uuid not null default gen_random_uuid() primary key,
  player_id uuid not null references auth.users on delete cascade,
  name text not null,
  numbers jsonb not null,
  uses_left integer not null default 1,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
-- Enable RLS for Player Cards
alter table public.player_cards enable row level security;
-- Policies for Player Cards
create policy "Users can manage their own cards" on public.player_cards for all using (auth.uid() = player_id);
create policy "Admins can view all player cards" on public.player_cards for select using (public.is_admin());


-- Create Match Cards Table (instances of player cards used in a specific match)
create table public.match_cards (
  id uuid not null default gen_random_uuid() primary key,
  player_card_id uuid not null references public.player_cards on delete cascade,
  player_id uuid not null references auth.users on delete cascade,
  match_id uuid not null references public.matches on delete cascade,
  name text not null,
  numbers jsonb not null,
  marked_numbers integer[] not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now())
);
-- Enable RLS for Match Cards
alter table public.match_cards enable row level security;
-- Policies for Match Cards
create policy "Users can view their own match cards" on public.match_cards for select using (auth.uid() = player_id);
create policy "Users can insert their own match cards" on public.match_cards for insert with check (auth.uid() = player_id);
create policy "Admins can view all match cards" on public.match_cards for select using (public.is_admin());
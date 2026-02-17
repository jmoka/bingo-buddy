-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' NOT NULL,
  credits INT DEFAULT 100 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  game_type TEXT NOT NULL,
  max_cards_per_player INT NOT NULL,
  card_price INT NOT NULL,
  prize JSONB NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  called_numbers INT[] DEFAULT '{}'::int[],
  pot INT DEFAULT 0 NOT NULL,
  is_auto_calling BOOLEAN DEFAULT false,
  next_auto_call_timestamp TIMESTAMPTZ,
  winners JSONB[] DEFAULT '{}'::jsonb[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create player_cards table
CREATE TABLE public.player_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  numbers JSONB NOT NULL,
  uses_left INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create match_cards table
CREATE TABLE public.match_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_card_id UUID NOT NULL REFERENCES public.player_cards(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  numbers JSONB NOT NULL,
  marked_numbers INT[] DEFAULT '{}'::int[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can manage their own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for matches
CREATE POLICY "Authenticated users can view matches" ON public.matches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage matches" ON public.matches
  FOR ALL USING (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')) 
  WITH CHECK (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));

-- RLS Policies for player_cards
CREATE POLICY "Users can manage their own player cards" ON public.player_cards
  FOR ALL USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- RLS Policies for match_cards
CREATE POLICY "Authenticated users can view all match cards" ON public.match_cards
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own match cards" ON public.match_cards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Admins can manage match cards" ON public.match_cards
  FOR UPDATE, DELETE USING (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));

-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

-- Trigger the function on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
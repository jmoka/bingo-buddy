-- Drop the existing function to replace it
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Recreate the function with improved security and explicit schema references
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = '' -- Reset search_path for security and stability
as $$
declare
  user_count integer;
begin
  -- Check how many users already exist in the profiles table
  select count(*) into user_count from public.perfis;

  -- Insert a new profile record for the new user
  insert into public.perfis (id, full_name, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    -- If this is the first user, assign 'admin' role, otherwise 'user'
    case when user_count = 0 then 'admin'::public.user_role else 'user'::public.user_role end
  );
  return new;
end;
$$;

-- The CASCADE on DROP FUNCTION also drops the trigger, so we must recreate it.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
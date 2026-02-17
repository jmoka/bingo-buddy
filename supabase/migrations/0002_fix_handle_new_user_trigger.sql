-- Drop the existing function and trigger to replace them
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Recreate the function with a simplified, more robust logic
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = '' -- Reset search_path for security
as $$
declare
  user_role public.user_role;
  user_count integer;
begin
  -- Check if any user exists to determine the role
  select count(*) into user_count from public.perfis;
  if user_count = 0 then
    user_role := 'admin';
  else
    user_role := 'user';
  end if;

  -- Insert only the essential data. full_name can be added by the user later.
  insert into public.perfis (id, role)
  values (new.id, user_role);

  return new;
end;
$$;

-- Recreate the trigger, as it was dropped by the CASCADE command above
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
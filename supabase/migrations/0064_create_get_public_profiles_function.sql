CREATE OR REPLACE FUNCTION public.get_public_profiles(p_user_ids uuid[])
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.perfis p
  WHERE p.id = ANY(p_user_ids);
$$;
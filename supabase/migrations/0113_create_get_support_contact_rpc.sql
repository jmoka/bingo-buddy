-- Retorna contato de suporte do admin (nome, whatsapp e email do auth.users)
CREATE OR REPLACE FUNCTION public.get_support_contact(p_admin_id uuid DEFAULT NULL)
RETURNS TABLE (
  admin_id uuid,
  full_name text,
  whatsapp text,
  email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH target_admin AS (
    SELECT a.id, a.full_name, a.whatsapp
    FROM public.admins a
    WHERE (p_admin_id IS NULL OR a.id = p_admin_id)
    ORDER BY (a.id = p_admin_id) DESC, a.id
    LIMIT 1
  )
  SELECT ta.id AS admin_id,
         ta.full_name,
         ta.whatsapp,
         u.email
  FROM target_admin ta
  LEFT JOIN auth.users u ON u.id = ta.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_support_contact(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

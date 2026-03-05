CREATE OR REPLACE FUNCTION public.get_public_vendedor_by_codigo(p_codigo_ref text)
RETURNS TABLE(
  nome text,
  telefone text,
  codigo_ref text,
  ativo boolean,
  avatar_url text,
  address text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.nome,
    v.telefone,
    v.codigo_ref,
    v.ativo,
    p.avatar_url,
    p.address
  FROM public.vendedores_rifa v
  JOIN public.perfis p ON v.user_id = p.id
  WHERE v.codigo_ref = UPPER(p_codigo_ref);
END;
$$;
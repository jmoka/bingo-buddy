-- 1. Libera a visualização das cartelas da partida para todos os jogadores
DROP POLICY IF EXISTS "Users can view their own match cards" ON public.cartelas_partida;
DROP POLICY IF EXISTS "Todos podem ver cartelas da partida" ON public.cartelas_partida;

CREATE POLICY "Permitir leitura global de cartelas da partida" 
ON public.cartelas_partida FOR SELECT 
USING (true);

-- 2. Melhora a função de buscar perfis para gerar um nome único (Ex: "Jogador A4F2")
CREATE OR REPLACE FUNCTION public.get_public_profiles(p_user_ids uuid[])
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    id, 
    COALESCE(full_name, 'Jogador ' || upper(substr(id::text, 1, 4))) as full_name, 
    avatar_url 
  FROM public.perfis 
  WHERE id = ANY(p_user_ids);
$$;

-- 3. Garante que as fotos de perfil (Avatars) possam ser vistas por todos os jogadores
DROP POLICY IF EXISTS "Avatar public access" ON storage.objects;
CREATE POLICY "Avatar public access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
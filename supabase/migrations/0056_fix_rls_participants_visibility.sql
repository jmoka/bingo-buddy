-- 1. Permitir que qualquer usuário logado veja as cartelas das partidas de todos
-- (Isso é necessário para contar os jogadores e mostrar quem está na partida)
DROP POLICY IF EXISTS "Users can view their own match cards" ON public.cartelas_partida;
DROP POLICY IF EXISTS "Admins can view all match cards" ON public.cartelas_partida;

CREATE POLICY "Todos podem ler cartelas_partida" 
ON public.cartelas_partida 
FOR SELECT 
USING (true);

-- 2. Permitir que qualquer usuário logado veja as informações de perfil (nome, avatar) de outros usuários
-- (Isso é necessário para renderizar os nomes e fotos na lista de participantes)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.perfis;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.perfis;

CREATE POLICY "Todos podem ler perfis" 
ON public.perfis 
FOR SELECT 
USING (true);
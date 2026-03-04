-- 1. Liberar Cartelas da Partida
DROP POLICY IF EXISTS "Users can view their own match cards" ON public.cartelas_partida;
DROP POLICY IF EXISTS "Todos podem ler cartelas_partida" ON public.cartelas_partida;
CREATE POLICY "Todos podem ler cartelas_partida" ON public.cartelas_partida FOR SELECT USING (true);

-- 2. Liberar Perfis
DROP POLICY IF EXISTS "Users can view their own profile" ON public.perfis;
DROP POLICY IF EXISTS "Todos podem ler perfis" ON public.perfis;
CREATE POLICY "Todos podem ler perfis" ON public.perfis FOR SELECT USING (true);

-- 3. Liberar Vitórias
DROP POLICY IF EXISTS "Users can view their own wins" ON public.vitorias;
DROP POLICY IF EXISTS "Todos podem ler vitorias" ON public.vitorias;
CREATE POLICY "Todos podem ler vitorias" ON public.vitorias FOR SELECT USING (true);
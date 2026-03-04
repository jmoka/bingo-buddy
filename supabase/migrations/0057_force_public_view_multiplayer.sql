-- 1. Liberar Cartelas da Partida (para contar jogadores e cartelas corretamente)
DROP POLICY IF EXISTS "Todos podem ler cartelas_partida" ON public.cartelas_partida;
CREATE POLICY "Todos podem ler cartelas_partida" 
ON public.cartelas_partida FOR SELECT USING (true);

-- 2. Liberar Perfis (para mostrar nomes e fotos de todos na lista)
DROP POLICY IF EXISTS "Todos podem ler perfis" ON public.perfis;
CREATE POLICY "Todos podem ler perfis" 
ON public.perfis FOR SELECT USING (true);

-- 3. Liberar Vitórias (para o Hall da Fama funcionar para todos)
DROP POLICY IF EXISTS "Todos podem ler vitorias" ON public.vitorias;
CREATE POLICY "Todos podem ler vitorias" 
ON public.vitorias FOR SELECT USING (true);
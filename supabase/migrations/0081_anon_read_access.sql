-- Permite que visitantes anônimos (deslogados) vejam a lista de partidas
CREATE POLICY "Anon read partidas" ON public.partidas FOR SELECT TO anon USING (true);

-- Permite que visitantes vejam as configurações globais (necessário para o Pote e Agenda)
CREATE POLICY "Anon read configuracoes" ON public.configuracoes FOR SELECT TO anon USING (true);

-- Permite leitura das cartelas das partidas para o Lobby conseguir contar quantos jogadores tem na sala
CREATE POLICY "Anon read cartelas_partida" ON public.cartelas_partida FOR SELECT TO anon USING (true);
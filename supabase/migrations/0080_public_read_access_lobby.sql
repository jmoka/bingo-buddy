-- Permite que visitantes anônimos (deslogados) vejam a lista de partidas
DROP POLICY IF EXISTS "Authenticated users can view matches" ON public.partidas;
CREATE POLICY "Permitir leitura publica de partidas" ON public.partidas FOR SELECT USING (true);

-- Permite que visitantes vejam as configurações globais (necessário para o Pote e Agenda)
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.configuracoes;
CREATE POLICY "Permitir leitura publica de configuracoes" ON public.configuracoes FOR SELECT USING (true);

-- Permite leitura das cartelas das partidas para o Lobby conseguir contar quantos jogadores tem na sala
DROP POLICY IF EXISTS "Users can view their own match cards" ON public.cartelas_partida;
DROP POLICY IF EXISTS "Admins can view all match cards" ON public.cartelas_partida;
CREATE POLICY "Permitir leitura publica de cartelas de partida" ON public.cartelas_partida FOR SELECT USING (true);
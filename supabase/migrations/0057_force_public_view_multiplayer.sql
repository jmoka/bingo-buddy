-- PASSO 1: APAGA AS REGRAS ANTIGAS E RESTRITIVAS QUE ESTÃO BLOQUEANDO
DROP POLICY IF EXISTS "Users can view their own match cards" ON public.cartelas_partida;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.perfis;
DROP POLICY IF EXISTS "Users can view their own wins" ON public.vitorias;

-- PASSO 2: CRIA NOVAS REGRAS QUE PERMITEM QUE JOGADORES LOGADOS VEJAM OS DADOS UNS DOS OUTROS
CREATE POLICY "Permitir que todos os jogadores vejam as cartelas da partida" 
ON public.cartelas_partida FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir que todos os jogadores vejam os perfis uns dos outros" 
ON public.perfis FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir que todos os jogadores vejam as vitorias uns dos outros" 
ON public.vitorias FOR SELECT TO authenticated USING (true);
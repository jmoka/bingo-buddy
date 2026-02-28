-- Permite que qualquer usuário autenticado leia todas as cartelas de partidas
-- necessário para exibir corretamente a contagem de jogadores e cartelas no Lobby
CREATE POLICY "usuarios autenticados podem ver cartelas de partidas"
ON cartelas_partida
FOR SELECT
USING (auth.role() = 'authenticated');

-- Permite leitura pública (anon + authenticated) nas tabelas usadas pela página de validação
-- Necessário pois ValidarCartela pode ser acessada sem login

-- rifas: qualquer um pode ver
DROP POLICY IF EXISTS "todos leem rifas" ON rifas;
CREATE POLICY "todos leem rifas" ON rifas FOR SELECT USING (true);

-- numeros_rifa: qualquer um pode ver
DROP POLICY IF EXISTS "todos leem numeros" ON numeros_rifa;
CREATE POLICY "todos leem numeros" ON numeros_rifa FOR SELECT USING (true);

-- cartelas_rifa: qualquer um pode buscar por codigo_validacao (necessário para validação pública)
DROP POLICY IF EXISTS "vendedor ve proprias cartelas" ON cartelas_rifa;
CREATE POLICY "vendedor ve proprias cartelas" ON cartelas_rifa FOR SELECT USING (
  true
);

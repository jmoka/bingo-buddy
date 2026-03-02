-- Recria a policy de SELECT em numeros_rifa garantindo que
-- qualquer usuário autenticado pode ler todos os números (necessário para validação/busca por número)
DROP POLICY IF EXISTS "todos leem numeros" ON numeros_rifa;
CREATE POLICY "todos leem numeros" ON numeros_rifa FOR SELECT USING (auth.role() = 'authenticated');

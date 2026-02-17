-- Adiciona uma política explícita para garantir que a service_role possa ler as configurações.
-- Embora a service_role deva ignorar o RLS, esta política serve como uma garantia adicional.
CREATE POLICY "Service role can read settings"
ON public.configuracoes
FOR SELECT
TO service_role
USING (true);
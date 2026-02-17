-- Add price per credit to settings
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS valor_por_credito NUMERIC(10, 2) NOT NULL DEFAULT 1.00;

-- Add requested amount to credit requests table
ALTER TABLE public.solicitacoes_credito
ADD COLUMN IF NOT EXISTS credits_requested INTEGER;

ALTER TABLE public.solicitacoes_credito
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2);

-- Update admin update policy to ensure it's comprehensive
DROP POLICY IF EXISTS "Admins can update credit requests" ON public.solicitacoes_credito;
CREATE POLICY "Admins can update credit requests"
ON public.solicitacoes_credito
FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
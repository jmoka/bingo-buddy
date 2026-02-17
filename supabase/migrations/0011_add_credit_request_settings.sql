-- Adiciona colunas para a solicitação de crédito via PIX
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS pix_key TEXT,
ADD COLUMN IF NOT EXISTS credit_request_text TEXT;

-- Cria o bucket para armazenar os comprovantes de pagamento
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Define as políticas de segurança para o bucket de comprovantes

-- 1. Permite que usuários autenticados enviem comprovantes para sua própria pasta
CREATE POLICY "Users can upload their own receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- 2. Permite que usuários autenticados vejam seus próprios comprovantes
CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- 3. Permite que administradores vejam todos os comprovantes
CREATE POLICY "Admins can view all receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts' AND is_admin());
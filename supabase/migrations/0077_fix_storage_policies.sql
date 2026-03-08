-- Assegura que administradores possam ler qualquer arquivo no bucket 'receipts'
CREATE POLICY "Admin read all receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND 
  EXISTS (
    SELECT 1 FROM public.perfis 
    WHERE id = auth.uid() AND role IN ('admin', 'dev')
  )
);

-- Assegura que administradores possam inserir arquivos em qualquer lugar no bucket 'receipts' (ex: comprovantes de pagamento de resgate)
CREATE POLICY "Admin insert all receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND 
  EXISTS (
    SELECT 1 FROM public.perfis 
    WHERE id = auth.uid() AND role IN ('admin', 'dev')
  )
);
-- Assegura que o bucket existe, é público e aceita PDFs
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES ('comprovantes_bingo', 'comprovantes_bingo', true, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], public = true;

-- Remove qualquer regra conflituosa
DROP POLICY IF EXISTS "Public Upload Comprovantes Bingo" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Comprovantes Bingo" ON storage.objects;

-- Regra definitiva para upload de qualquer pessoa no bucket comprovantes_bingo
CREATE POLICY "Public Upload Comprovantes Bingo" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'comprovantes_bingo');

-- Regra definitiva para leitura de qualquer pessoa no bucket comprovantes_bingo
CREATE POLICY "Public Read Comprovantes Bingo" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'comprovantes_bingo');
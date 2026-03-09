-- Garante a existência do bucket e que ele aceite PDF e imagens
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  'comprovantes_bingo', 
  'comprovantes_bingo', 
  true, 
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    public = true;

-- Remove políticas anteriores
DROP POLICY IF EXISTS "Public Upload Comprovantes Bingo" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Comprovantes Bingo" ON storage.objects;

-- Permite que QUALQUER pessoa (anon ou autenticado) insira arquivos no bucket 'comprovantes_bingo'
CREATE POLICY "Public Upload Comprovantes Bingo" 
ON storage.objects FOR INSERT 
TO public
WITH CHECK (bucket_id = 'comprovantes_bingo');

-- Permite que QUALQUER pessoa leia os arquivos
CREATE POLICY "Public Read Comprovantes Bingo" 
ON storage.objects FOR SELECT 
TO public
USING (bucket_id = 'comprovantes_bingo');
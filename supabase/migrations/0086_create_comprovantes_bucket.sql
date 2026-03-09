-- Habilita RLS na tabela objects caso não esteja
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Cria o bucket 'comprovantes_bingo' se não existir, garantindo que aceita PDF e imagens
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

-- Remove políticas antigas caso existam para evitar duplicidade
DROP POLICY IF EXISTS "Public Upload Comprovantes Bingo" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Comprovantes Bingo" ON storage.objects;

-- Permite que qualquer pessoa (mesmo sem login) faça upload de comprovantes
CREATE POLICY "Public Upload Comprovantes Bingo" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'comprovantes_bingo');

-- Permite que qualquer pessoa leia os comprovantes gerados (para o admin e o cliente poderem ver o arquivo)
CREATE POLICY "Public Read Comprovantes Bingo" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'comprovantes_bingo');
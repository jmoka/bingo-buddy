-- Adiciona a coluna prize_image_url à tabela de partidas
ALTER TABLE public.partidas
ADD COLUMN prize_image_url TEXT;

-- Cria o bucket de armazenamento para as imagens dos prêmios
INSERT INTO storage.buckets (id, name, public)
VALUES ('prizes', 'prizes', true)
ON CONFLICT (id) DO NOTHING;

-- Define as políticas de acesso para o bucket de prêmios
-- Permite acesso público de leitura
CREATE POLICY "Public read access for prizes" ON storage.objects
FOR SELECT USING (bucket_id = 'prizes');

-- Permite que administradores façam upload
CREATE POLICY "Admin can upload prizes" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'prizes' AND
  (select role from public.perfis where id = auth.uid()) = 'admin'::user_role
);

-- Permite que administradores atualizem seus uploads
CREATE POLICY "Admin can update their prizes" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'prizes' AND
  (select role from public.perfis where id = auth.uid()) = 'admin'::user_role
);

-- Permite que administradores deletem seus uploads
CREATE POLICY "Admin can delete their prizes" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'prizes' AND
  (select role from public.perfis where id = auth.uid()) = 'admin'::user_role
);
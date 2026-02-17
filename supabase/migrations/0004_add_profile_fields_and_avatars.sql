-- Adiciona novas colunas à tabela de perfis
ALTER TABLE public.perfis
ADD COLUMN cpf TEXT,
ADD COLUMN whatsapp TEXT,
ADD COLUMN address TEXT;

-- Cria um bucket de armazenamento para avatares
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Define políticas de segurança para o bucket de avatares
-- 1. Permite acesso público de leitura aos avatares
CREATE POLICY "Avatar images are publicly accessible."
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 2. Permite que usuários autenticados enviem seu próprio avatar
CREATE POLICY "Users can upload their own avatar."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );

-- 3. Permite que usuários autenticados atualizem seu próprio avatar
CREATE POLICY "Users can update their own avatar."
ON storage.objects FOR UPDATE
TO authenticated
USING ( auth.uid() = owner );

-- 4. Permite que usuários autenticados excluam seu próprio avatar
CREATE POLICY "Users can delete their own avatar."
ON storage.objects FOR DELETE
TO authenticated
USING ( auth.uid() = owner );
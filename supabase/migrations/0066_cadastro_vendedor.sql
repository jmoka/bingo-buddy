CREATE TABLE IF NOT EXISTS public.cadastro_vendedor (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE UNIQUE,
  nome_completo TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  cpf TEXT,
  rg TEXT,
  foto_url TEXT,
  documento_url TEXT,
  comprovante_endereco_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.cadastro_vendedor ENABLE ROW LEVEL SECURITY;

-- Permite que qualquer pessoa acesse os dados (necessário para a página pública)
CREATE POLICY "Public read cadastro_vendedor" ON public.cadastro_vendedor FOR SELECT USING (true);
CREATE POLICY "Users can insert own cadastro" ON public.cadastro_vendedor FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cadastro" ON public.cadastro_vendedor FOR UPDATE USING (auth.uid() = user_id);

-- Conserta a permissão da tabela vendedores_rifa para a página pública funcionar!
DROP POLICY IF EXISTS "Public read vendedores_rifa" ON public.vendedores_rifa;
CREATE POLICY "Public read vendedores_rifa" ON public.vendedores_rifa FOR SELECT USING (true);
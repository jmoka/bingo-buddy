-- ==============================================================================
-- MIGRATION: 0105 - ARQUITETURA SAAS / MULTI-TENANT (MÚLTIPLOS ADMINS)
-- ==============================================================================

-- 1. Garante que a tabela admins existe e tem RLS
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role public.user_role DEFAULT 'admin'::public.user_role,
  credits INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  bloqueado BOOLEAN DEFAULT false,
  fake_credits NUMERIC DEFAULT 0,
  cpf TEXT,
  whatsapp TEXT,
  address TEXT
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Admins podem ler a própria linha
CREATE POLICY "Admins podem ler proprio perfil" ON public.admins
FOR SELECT USING (auth.uid() = id);

-- 2. Atualiza a função global de verificação de Admin
-- Agora o sistema olha para a tabela "admins" e não mais para o "perfis"
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  );
$$;

-- 3. Adiciona admin_id em TODAS as tabelas e vendedor_id onde for útil
-- Obs: Usamos ON DELETE CASCADE para que, se um Admin for deletado, todo o bingo dele suma.

-- Perfis (Jogadores)
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS admins_id UUID REFERENCES public.admins(id) ON DELETE SET NULL;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores_rifa(id) ON DELETE SET NULL;

-- Configurações (Cada admin terá sua própria linha de configuração, stripe, pix, etc)
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;

-- Bingo
ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;

ALTER TABLE public.cartelas_jogador ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.cartelas_jogador ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores_rifa(id) ON DELETE SET NULL;

ALTER TABLE public.cartelas_partida ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.cartelas_partida ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores_rifa(id) ON DELETE SET NULL;

ALTER TABLE public.vendas_bingo_fisico ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;

-- Rifas
ALTER TABLE public.rifas ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.numeros_rifa ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.compras_rifa ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.cartelas_rifa ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;

-- Vendedores e Clientes
ALTER TABLE public.vendedores_rifa ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.cadastro_vendedor ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.clientes_rifa ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.acertos_vendedor ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;

-- Financeiro e Histórico
ALTER TABLE public.solicitacoes_credito ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.solicitacoes_resgate ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.solicitacoes_vendedor ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;
ALTER TABLE public.vitorias ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.admins(id) ON DELETE CASCADE;


-- ==============================================================================
-- 4. SCRIPT DE TRANSIÇÃO (SALVA-VIDAS DE DADOS ANTIGOS)
-- Como o sistema antigo não tinha admin_id, vamos vincular todos os dados atuais 
-- ao PRIMEIRO admin que existir na tabela admins para o app não quebrar na hora.
-- ==============================================================================

DO $$
DECLARE
    v_primeiro_admin_id UUID;
BEGIN
    -- Pega o primeiro admin cadastrado
    SELECT id INTO v_primeiro_admin_id FROM public.admins LIMIT 1;

    IF v_primeiro_admin_id IS NOT NULL THEN
        -- Atualiza os dados antigos
        UPDATE public.perfis SET admins_id = v_primeiro_admin_id WHERE admins_id IS NULL;
        UPDATE public.configuracoes SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.partidas SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.cartelas_jogador SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.cartelas_partida SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.vendas_bingo_fisico SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.rifas SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.numeros_rifa SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.compras_rifa SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.cartelas_rifa SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.vendedores_rifa SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.cadastro_vendedor SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.clientes_rifa SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.acertos_vendedor SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.solicitacoes_credito SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.solicitacoes_resgate SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.solicitacoes_vendedor SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
        UPDATE public.vitorias SET admin_id = v_primeiro_admin_id WHERE admin_id IS NULL;
    END IF;
END $$;

-- Atualizar o cache da API do Supabase
NOTIFY pgrst, 'reload schema';
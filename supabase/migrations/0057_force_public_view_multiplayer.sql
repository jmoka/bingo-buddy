-- 1. DESATIVA O RLS PARA LIMPEZA
ALTER TABLE public.cartelas_partida DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitorias DISABLE ROW LEVEL SECURITY;

-- 2. APAGA TODAS AS POLÍTICAS EXISTENTES (Loop de limpeza)
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('cartelas_partida', 'perfis', 'vitorias')) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. CRIA REGRAS DE ACESSO TOTAL PARA LEITURA
CREATE POLICY "Acesso publico total" ON public.cartelas_partida FOR SELECT USING (true);
CREATE POLICY "Acesso publico total" ON public.perfis FOR SELECT USING (true);
CREATE POLICY "Acesso publico total" ON public.vitorias FOR SELECT USING (true);

-- 4. REATIVA O RLS
ALTER TABLE public.cartelas_partida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitorias ENABLE ROW LEVEL SECURITY;
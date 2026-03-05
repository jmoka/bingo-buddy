-- Esta migração tenta adicionar o valor 'vendedor' ao enum 'user_role'
-- de forma segura, verificando primeiro se ele já existe.

DO $$ 
BEGIN
    -- Verifica se o valor 'vendedor' já existe no enum 'user_role'
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'user_role' AND e.enumlabel = 'vendedor'
    ) THEN
        -- Adiciona o valor se não existir
        -- Nota: ALTER TYPE ... ADD VALUE não pode rodar dentro de uma transação em algumas versões do Postgres,
        -- mas no Supabase/PostgreSQL 12+ costuma funcionar se for o único comando.
        ALTER TYPE public.user_role ADD VALUE 'vendedor';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Se por acaso houver uma condição de corrida e o valor já existir, ignoramos o erro.
        NULL;
END $$;
-- This migration ensures the 'vendedor' role is added to the user_role enum.
-- This is a critical fix for the "invalid input value for enum user_role" error.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'vendedor') THEN
        ALTER TYPE public.user_role ADD VALUE 'vendedor';
    END IF;
END$$;
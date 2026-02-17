-- Create status type for credit requests
-- Use `CREATE TYPE IF NOT EXISTS` if supported, otherwise this might fail on reruns if the type exists.
-- For simplicity, we assume this part passed or the user can handle it. A better approach for production is more complex.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_request_status') THEN
        CREATE TYPE credit_request_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END$$;


-- Create credit_requests table
CREATE TABLE IF NOT EXISTS public.solicitacoes_credito (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status credit_request_status NOT NULL DEFAULT 'pending',
  receipt_url TEXT NOT NULL,
  credits_granted INTEGER,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT -- Admin can add notes on resolution
);

-- Enable RLS
ALTER TABLE public.solicitacoes_credito ENABLE ROW LEVEL SECURITY;

-- Policies for credit requests table
DROP POLICY IF EXISTS "Users can create their own credit requests" ON public.solicitacoes_credito;
CREATE POLICY "Users can create their own credit requests"
ON public.solicitacoes_credito
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can view their own credit requests" ON public.solicitacoes_credito;
CREATE POLICY "Users can view their own credit requests"
ON public.solicitacoes_credito
FOR SELECT TO authenticated
USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Admins can view all credit requests" ON public.solicitacoes_credito;
CREATE POLICY "Admins can view all credit requests"
ON public.solicitacoes_credito
FOR SELECT TO authenticated
USING (is_admin());

DROP POLICY IF EXISTS "Admins can update credit requests" ON public.solicitacoes_credito;
CREATE POLICY "Admins can update credit requests"
ON public.solicitacoes_credito
FOR UPDATE TO authenticated
USING (is_admin());

-- Create a new storage bucket for receipts if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts bucket
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can view their own receipts" ON storage.objects;
CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Admins can view all receipts" ON storage.objects;
CREATE POLICY "Admins can view all receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts' AND is_admin());
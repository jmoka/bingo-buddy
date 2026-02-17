-- Create status type for credit requests
CREATE TYPE credit_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create credit_requests table
CREATE TABLE public.solicitacoes_credito (
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

-- Policies
-- Users can create their own requests
CREATE POLICY "Users can create their own credit requests"
ON public.solicitacoes_credito
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = player_id);

-- Users can view their own requests
CREATE POLICY "Users can view their own credit requests"
ON public.solicitacoes_credito
FOR SELECT TO authenticated
USING (auth.uid() = player_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all credit requests"
ON public.solicitacoes_credito
FOR SELECT TO authenticated
USING (is_admin());

-- Admins can update requests (to approve/reject)
CREATE POLICY "Admins can update credit requests"
ON public.solicitacoes_credito
FOR UPDATE TO authenticated
USING (is_admin());

-- Create a new storage bucket for receipts if it doesn't exist
-- This is an insert statement, so it's idempotent.
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts bucket
-- Users can upload their own receipts
CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own receipts
CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can view all receipts
CREATE POLICY "Admins can view all receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts' AND is_admin());
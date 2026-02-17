-- Drop the old, incorrect policy
DROP POLICY IF EXISTS "Users can resubmit their own rejected requests" ON public.solicitacoes_credito;

-- Create the new, correct policy that allows changing the status to 'pending'
CREATE POLICY "Users can resubmit their own rejected requests"
ON public.solicitacoes_credito
FOR UPDATE
TO authenticated
USING ((auth.uid() = player_id) AND (status = 'rejected'::credit_request_status))
WITH CHECK (auth.uid() = player_id);
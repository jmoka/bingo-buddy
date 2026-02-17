CREATE POLICY "Users can resubmit their own rejected requests"
ON public.solicitacoes_credito
FOR UPDATE
TO authenticated
USING (auth.uid() = player_id AND status = 'rejected');
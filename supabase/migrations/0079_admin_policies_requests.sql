-- Policies for solicitacoes_credito
CREATE POLICY "Admins can view all credit requests" ON public.solicitacoes_credito
FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can update all credit requests" ON public.solicitacoes_credito
FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can delete all credit requests" ON public.solicitacoes_credito
FOR DELETE TO authenticated USING (public.is_admin());

-- Policies for solicitacoes_resgate
CREATE POLICY "Admins can view all redeem requests" ON public.solicitacoes_resgate
FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can update all redeem requests" ON public.solicitacoes_resgate
FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can delete all redeem requests" ON public.solicitacoes_resgate
FOR DELETE TO authenticated USING (public.is_admin());

-- Policies for mensagens_solicitacao
CREATE POLICY "Admins can view all credit request messages" ON public.mensagens_solicitacao
FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can insert credit request messages" ON public.mensagens_solicitacao
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Policies for mensagens_resgate
CREATE POLICY "Admins can view all redeem request messages" ON public.mensagens_resgate
FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can insert redeem request messages" ON public.mensagens_resgate
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Policies for clientes_rifa
CREATE POLICY "Admins can read all clientes_rifa" ON public.clientes_rifa
FOR SELECT TO authenticated USING (public.is_admin());
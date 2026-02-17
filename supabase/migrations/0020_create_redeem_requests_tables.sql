-- Enum para status de resgate
DO $$ BEGIN
    CREATE TYPE public.redeem_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de solicitações de resgate
CREATE TABLE public.solicitacoes_resgate (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status public.redeem_request_status DEFAULT 'pending' NOT NULL,
  credits_requested INTEGER NOT NULL,
  amount_to_receive NUMERIC NOT NULL,
  receipt_url TEXT, -- URL do comprovante enviado pelo ADMIN ao aprovar
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  resubmission_notes TEXT
);

-- Tabela de mensagens para o chat de resgate
CREATE TABLE public.mensagens_resgate (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  redeem_request_id UUID REFERENCES public.solicitacoes_resgate(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Ativar RLS
ALTER TABLE public.solicitacoes_resgate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_resgate ENABLE ROW LEVEL SECURITY;

-- Políticas para Resgates
CREATE POLICY "Users can view their own redeem requests" ON public.solicitacoes_resgate
FOR SELECT TO authenticated USING (auth.uid() = player_id);

CREATE POLICY "Users can create their own redeem requests" ON public.solicitacoes_resgate
FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Admins can view all redeem requests" ON public.solicitacoes_resgate
FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Admins can update redeem requests" ON public.solicitacoes_resgate
FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "Users can resubmit rejected redeem requests" ON public.solicitacoes_resgate
FOR UPDATE TO authenticated USING (auth.uid() = player_id AND status = 'rejected');

-- Políticas para Mensagens de Resgate
CREATE POLICY "Users can view messages of their own redeem requests" ON public.mensagens_resgate
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM solicitacoes_resgate WHERE id = mensagens_resgate.redeem_request_id AND player_id = auth.uid()
));

CREATE POLICY "Admins can view all redeem messages" ON public.mensagens_resgate
FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Users/Admins can insert messages" ON public.mensagens_resgate
FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND (
    is_admin() OR EXISTS (
      SELECT 1 FROM solicitacoes_resgate WHERE id = mensagens_resgate.redeem_request_id AND player_id = auth.uid()
    )
  )
);
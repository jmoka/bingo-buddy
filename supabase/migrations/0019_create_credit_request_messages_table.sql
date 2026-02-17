-- Criar a tabela de mensagens
CREATE TABLE public.mensagens_solicitacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_request_id UUID NOT NULL REFERENCES public.solicitacoes_credito(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.mensagens_solicitacao ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
-- Admins podem ver todas as mensagens
CREATE POLICY "Admins can view all messages" ON public.mensagens_solicitacao
FOR SELECT TO authenticated USING (is_admin());

-- Usuários podem ver mensagens de suas próprias solicitações
CREATE POLICY "Users can view messages of their own requests" ON public.mensagens_solicitacao
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_credito
    WHERE id = credit_request_id AND player_id = auth.uid()
  )
);

-- Admins podem inserir mensagens
CREATE POLICY "Admins can insert messages" ON public.mensagens_solicitacao
FOR INSERT TO authenticated WITH CHECK (is_admin());

-- Usuários podem inserir mensagens em suas solicitações
CREATE POLICY "Users can insert messages into their own requests" ON public.mensagens_solicitacao
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_credito
    WHERE id = credit_request_id AND player_id = auth.uid()
  )
);
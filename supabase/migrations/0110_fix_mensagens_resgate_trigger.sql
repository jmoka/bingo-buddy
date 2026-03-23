CREATE OR REPLACE FUNCTION public.set_admin_id_from_redeem_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- SEGURANÇA: Sempre pega o admin_id da solicitação pai (Zero Trust no input do cliente)
  SELECT admin_id INTO NEW.admin_id 
  FROM public.solicitacoes_resgate 
  WHERE id = NEW.redeem_request_id;
  RETURN NEW;
END;
$$;

-- Remove possível trigger antigo se existir
DROP TRIGGER IF EXISTS trg_mensagens_resgate_admin ON public.mensagens_resgate;

-- Aplica o trigger em todas as inserções de mensagens de resgate
CREATE TRIGGER trg_mensagens_resgate_admin
BEFORE INSERT ON public.mensagens_resgate
FOR EACH ROW EXECUTE FUNCTION public.set_admin_id_from_redeem_request();

-- Remove o valor default que causava o erro silencioso
ALTER TABLE public.mensagens_resgate ALTER COLUMN admin_id DROP DEFAULT;
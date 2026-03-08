-- Adicionar coluna para confirmar o recebimento do prêmio da rifa
ALTER TABLE public.rifas
ADD COLUMN ganhador_confirmou BOOLEAN DEFAULT FALSE;

-- Criar a função RPC para o próprio usuário ganhador confirmar que viu/recebeu o prêmio
CREATE OR REPLACE FUNCTION confirmar_ganho_rifa(p_rifa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_updated INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rifas
  SET ganhador_confirmou = TRUE
  WHERE id = p_rifa_id AND ganhador_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  IF v_updated > 0 THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

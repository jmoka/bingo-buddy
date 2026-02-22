-- Adiciona a coluna de hora de início para o motor automático
ALTER TABLE public.configuracoes 
ADD COLUMN IF NOT EXISTS auto_engine_start_hour integer DEFAULT 0;
-- Create the settings table to store game rules
CREATE TABLE public.configuracoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  custo_nova_cartela integer NOT NULL DEFAULT 10,
  custo_recarga_cartela integer NOT NULL DEFAULT 5,
  usos_por_recarga integer NOT NULL DEFAULT 1,
  intervalo_sorteio_auto_seg integer NOT NULL DEFAULT 120,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for security
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- 1. Admins can manage all settings
CREATE POLICY "Admins can manage settings" ON public.configuracoes
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. Authenticated users can read settings (needed for client-side logic)
CREATE POLICY "Authenticated users can read settings" ON public.configuracoes
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insert the single default row of settings
INSERT INTO public.configuracoes (singleton) VALUES (true);
ALTER TABLE public.configuracoes 
ADD COLUMN stripe_pass_fees_to_customer boolean DEFAULT false,
ADD COLUMN stripe_fee_percentage numeric DEFAULT 3.99,
ADD COLUMN stripe_fee_fixed numeric DEFAULT 0.39;
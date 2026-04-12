-- Regra crítica: nunca permitir preço de partida negativo.
ALTER TABLE public.partidas
  DROP CONSTRAINT IF EXISTS partidas_card_price_non_negative;

ALTER TABLE public.partidas
  ADD CONSTRAINT partidas_card_price_non_negative
  CHECK (card_price >= 0);

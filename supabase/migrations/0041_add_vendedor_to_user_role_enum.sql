-- Adiciona o valor 'vendedor' ao tipo ENUM user_role.
-- Isso é necessário para que a função aprovar_vendedor possa
-- promover um usuário para o novo papel.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'vendedor';
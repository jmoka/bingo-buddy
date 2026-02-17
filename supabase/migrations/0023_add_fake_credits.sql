-- Adiciona a coluna para créditos de brincar na tabela de perfis
ALTER TABLE public.perfis
ADD COLUMN fake_credits INTEGER NOT NULL DEFAULT 0;

-- Adiciona um tipo de crédito para as cartelas dos jogadores
ALTER TABLE public.cartelas_jogador
ADD COLUMN credit_type TEXT NOT NULL DEFAULT 'real';

-- Atualiza a função de criação de novo usuário
-- Novos usuários agora começam com 0 créditos reais e 100 de brincar.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  user_role public.user_role;
  user_count integer;
begin
  -- Verifica se algum usuário existe para determinar o papel
  select count(*) into user_count from public.perfis;
  if user_count = 0 then
    user_role := 'admin';
  else
    user_role := 'user';
  end if;

  -- Insere o novo usuário com 0 créditos reais e 100 de brincar
  insert into public.perfis (id, role, credits, fake_credits)
  values (new.id, user_role, 0, 100);

  return new;
end;
$function$;
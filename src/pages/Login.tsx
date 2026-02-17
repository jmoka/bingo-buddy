import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

const Login = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      navigate('/');
    }
  }, [session, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card-container max-w-sm w-full">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-4 text-center">Bingo</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          theme="light"
          localization={{
            variables: {
              sign_in: {
                email_label: 'Email',
                password_label: 'Senha',
                button_label: 'Entrar',
                link_text: 'Já tem uma conta? Entre',
              },
              sign_up: {
                email_label: 'Email',
                password_label: 'Senha',
                button_label: 'Cadastrar',
                link_text: 'Não tem uma conta? Cadastre-se',
                social_provider_text: 'Entrar com {{provider}}',
              },
              forgotten_password: {
                email_label: 'Email',
                password_label: 'Senha',
                button_label: 'Enviar instruções',
                link_text: 'Esqueceu sua senha?',
              }
            },
          }}
        />
      </div>
    </div>
  );
};

export default Login;
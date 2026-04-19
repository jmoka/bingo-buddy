import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

export default defineConfig(({ mode }) => {
  // Carregar variaveis de ambiente do arquivo .env apropriado
  const fileEnv = loadEnv(mode, process.cwd(), '');

  // Valores padrao para producao (fallback)
  const defaultEnv = {
    VITE_SUPABASE_URL: 'https://vqvnodwojefubbbnbyar.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdm5vZHdvamVmdWJiYm5ieWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjkzNjksImV4cCI6MjA4NjkwNTM2OX0.fDEqqVZXw9TLnVOzsWRoEaKdngtrm-fJRbPtDLO1tLU',
    VITE_LIVE_SERVER_URL: '',
  };

  // Mesclar: arquivo .env > process.env > valores padrao
  const env = {
    ...defaultEnv,
    ...fileEnv,
    VITE_SUPABASE_URL: fileEnv.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || defaultEnv.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || defaultEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_LIVE_SERVER_URL: fileEnv.VITE_LIVE_SERVER_URL || process.env.VITE_LIVE_SERVER_URL || defaultEnv.VITE_LIVE_SERVER_URL,
  };

  return {
    server: {
      host: '::',
      port: 8080,
      watch: {
        usePolling: true,
        interval: 100,
      },
      hmr: {
        overlay: true,
      },
    },

    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    envPrefix: 'VITE_',

    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY),
      'import.meta.env.VITE_LIVE_SERVER_URL': JSON.stringify(env.VITE_LIVE_SERVER_URL),
    },
  };
});

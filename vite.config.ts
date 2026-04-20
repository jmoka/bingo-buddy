import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const VITE_SUPABASE_URL =
    process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;

  const VITE_SUPABASE_PUBLISHABLE_KEY =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const VITE_LIVE_SERVER_URL =
    process.env.VITE_LIVE_SERVER_URL || env.VITE_LIVE_SERVER_URL || '';

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
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        VITE_SUPABASE_PUBLISHABLE_KEY
      ),
      'import.meta.env.VITE_LIVE_SERVER_URL': JSON.stringify(
        VITE_LIVE_SERVER_URL
      ),
    },
  };
});
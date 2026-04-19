import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente do arquivo .env apropriado
  const fileEnv = loadEnv(mode, process.cwd(), "");
  
  // Mesclar com process.env (para variáveis de sistema/container)
  const env = {
    ...fileEnv,
    VITE_SUPABASE_URL: fileEnv.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_LIVE_SERVER_URL: fileEnv.VITE_LIVE_SERVER_URL || process.env.VITE_LIVE_SERVER_URL,
  };

  return {
    server: {
      host: "::",
      port: 8080,

      // 🔴 CORREÇÃO PRINCIPAL
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
      mode === "development" && componentTagger(),
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    // Configurar prefixo das variáveis de ambiente
    envPrefix: 'VITE_',

    define: {
      // Injetar variáveis de ambiente no código compilado
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY),
      "import.meta.env.VITE_LIVE_SERVER_URL": JSON.stringify(env.VITE_LIVE_SERVER_URL),
    },
  };
});
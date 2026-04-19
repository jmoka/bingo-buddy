import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// DEBUG: Verificar se as variáveis estão sendo carregadas
console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_KEY exists:', !!SUPABASE_PUBLISHABLE_KEY);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: {
    schema: 'public',
  },
});
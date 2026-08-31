import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Supabase] Credentials saknas. Kontrollera att VITE_SUPABASE_URL och ' +
    'VITE_SUPABASE_PUBLISHABLE_KEY är ifyllda i .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

import { createClient } from '@supabase/supabase-js';

export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://fehdtfncbutesgadjsxp.supabase.co';
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mf3Wmwk6mMO-EoYaDxMUvA_CihTsTBF';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

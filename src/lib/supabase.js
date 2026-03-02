import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fehdtfncbutesgadjsxp.supabase.co'
const supabaseAnonKey = 'sb_publishable_mf3Wmwk6mMO-EoYaDxMUvA_CihTsTBF'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

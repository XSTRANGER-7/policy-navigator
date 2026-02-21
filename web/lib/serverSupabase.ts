import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Use service role key if available; otherwise fall back to anon key for dev/testing
// Service role key is required (or proper RLS policies) for production writes
const supabaseKey = supabaseServiceKey ?? supabaseAnonKey

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase environment variables are not set: SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabaseServer = createClient(supabaseUrl ?? '', supabaseKey ?? '')
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey)
export const supabaseIsServiceRole = Boolean(
  supabaseServiceKey && supabaseServiceKey.startsWith?.('service_role')
)

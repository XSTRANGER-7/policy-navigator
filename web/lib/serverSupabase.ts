import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Use service role key if available; otherwise fall back to anon key for dev/testing
const supabaseKey = supabaseServiceKey ?? supabaseAnonKey;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const supabaseIsServiceRole = Boolean(
  supabaseServiceKey && supabaseServiceKey.startsWith?.("service_role"),
);

// Only create the client when Supabase is actually configured.
// This avoids crashing at import time when env vars are missing.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }
    _client = createClient(supabaseUrl, supabaseKey);
  }
  return _client;
}

/** Lazy-initialized Supabase server client. Only access when supabaseConfigured is true. */
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});

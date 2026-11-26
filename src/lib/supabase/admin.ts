import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv, supabaseUrl } from "@/lib/env";

/**
 * Service-role client. Bypasses Row Level Security, so it is ONLY used by
 * server-to-server endpoints that check their own secret (n8n automation,
 * WhatsApp webhook). Never import this into a page or client component.
 */
export function createAdminClient() {
  const key = serverEnv().serviceRoleKey;
  if (!supabaseUrl || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

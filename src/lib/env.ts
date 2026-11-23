// Central place for reading environment variables.
// Anything without NEXT_PUBLIC_ is only ever available on the server.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function serverEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    openaiKey: process.env.OPENAI_API_KEY ?? "",
    openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    automationSecret: process.env.AUTOMATION_SECRET ?? "",
    appUrl: process.env.APP_URL ?? "",
    whatsapp: {
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
      appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
      allowedNumbers: (process.env.WHATSAPP_ALLOWED_NUMBERS ?? "")
        .split(",")
        .map((n) => n.replace(/\D/g, ""))
        .filter(Boolean),
    },
  };
}

export function isAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isWhatsAppConfigured() {
  const w = serverEnv().whatsapp;
  return Boolean(w.verifyToken && w.appSecret && w.accessToken && w.phoneNumberId && w.allowedNumbers.length);
}

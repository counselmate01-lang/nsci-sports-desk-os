import { NextResponse } from "next/server";
import { isAIConfigured, isSupabaseConfigured, isWhatsAppConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

// Public health check. Reveals only whether things are configured, never values.
export function GET() {
  return NextResponse.json({
    ok: true,
    supabase: isSupabaseConfigured(),
    ai: isAIConfigured(),
    whatsapp: isWhatsAppConfigured(),
  });
}

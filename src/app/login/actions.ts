"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; message?: string } | null;

function safeNext(next: unknown) {
  const n = typeof next === "string" ? next : "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Incorrect email or password." };
  redirect(safeNext(formData.get("next")));
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email first." };
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  // shouldCreateUser: false -> only invited team members can sign in
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { error: "Could not send a link. Is this email invited to the team?" };
  return { message: "Check your inbox for a sign-in link." };
}

export async function sendPasswordReset(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email first." };
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/auth/set-password` });
  return { message: "If that email is on the team, a reset link is on its way." };
}

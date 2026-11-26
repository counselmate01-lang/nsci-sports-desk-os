"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export default function SetPasswordPage() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    const confirm = String(fd.get("confirm"));
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-base font-semibold">Set your password</h1>
        <Field label="New password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <Button type="submit" className="w-full justify-center" disabled={busy}>
          {busy ? "Saving…" : "Save and continue"}
        </Button>
      </form>
    </div>
  );
}

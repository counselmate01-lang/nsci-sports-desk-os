"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { sendMagicLink, sendPasswordReset, signIn, type LoginState } from "./actions";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = React.useActionState<LoginState, FormData>(signIn, initialError ? { error: "That link has expired. Please sign in again." } : null);
  const [linkState, linkAction, linkPending] = React.useActionState<LoginState, FormData>(sendMagicLink, null);
  const [resetState, resetAction, resetPending] = React.useActionState<LoginState, FormData>(sendPasswordReset, null);
  const msg = resetState ?? linkState ?? state;

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" />
      </Field>
      {msg?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{msg.error}</p>}
      {msg?.message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg.message}</p>}
      <Button type="submit" className="w-full justify-center" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex justify-between text-xs">
        <button formAction={linkAction} formNoValidate className="text-brand-700 hover:underline" disabled={linkPending}>
          Email me a sign-in link
        </button>
        <button formAction={resetAction} formNoValidate className="text-slate-500 hover:underline" disabled={resetPending}>
          Forgot password?
        </button>
      </div>
    </form>
  );
}

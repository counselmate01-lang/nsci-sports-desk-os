import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-[11px] font-semibold tracking-widest text-slate-400">NSCI</p>
          <h1 className="text-lg font-semibold text-slate-900">Sports Desk OS</h1>
          <p className="mt-1 text-xs text-slate-500">Sign in with your team account</p>
        </div>
        <LoginForm next={sp.next ?? "/"} initialError={sp.error} />
        <p className="mt-6 text-center text-xs text-slate-400">Access is by invitation only. Ask an admin to invite you.</p>
      </div>
    </div>
  );
}

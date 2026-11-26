import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-slate-50";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-9 py-0", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-20", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(field, "h-9 py-0 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-xs font-medium text-slate-600", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </Label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; error?: string; message?: string } | null }) {
  if (!state) return null;
  if (!state.ok && "error" in state && state.error) {
    return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>;
  }
  if (state.ok && state.message) {
    return <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{state.message}</p>;
  }
  return null;
}

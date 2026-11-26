"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { LogOut, Menu, Plus, Search, X } from "lucide-react";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QuickTaskDialog } from "@/components/tasks/quick-task-dialog";

export interface ShellProject {
  id: string;
  name: string;
}

export function AppShell({
  children,
  projects,
  userName,
  role,
  dueReminders,
  today,
}: {
  children: React.ReactNode;
  projects: ShellProject[];
  userName: string;
  role: string;
  dueReminders: number;
  today: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [taskOpen, setTaskOpen] = React.useState(false);
  const canEdit = role !== "viewer";

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Keyboard shortcut: "n" opens New task, "/" focuses search
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "n" && canEdit) {
        e.preventDefault();
        setTaskOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium",
            isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
          {href === "/" && dueReminders > 0 && (
            <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{dueReminders}</span>
          )}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold tracking-widest text-slate-400">NSCI</p>
          <p className="text-sm font-semibold text-slate-900">Sports Desk OS</p>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-slate-200 p-3">
          <p className="truncate px-2 text-xs font-medium text-slate-700">{userName}</p>
          <p className="px-2 text-[11px] capitalize text-slate-400">{role}</p>
          <form action="/auth/signout" method="post">
            <button className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold">NSCI Sports Desk OS</p>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded p-1 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <form action="/auth/signout" method="post" className="border-t border-slate-200 p-3">
              <p className="mb-2 truncate px-2 text-xs text-slate-600">{userName}</p>
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </form>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:px-5">
          <button className="rounded-md p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <form
            className="relative max-w-md flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q")?.toString().trim();
              if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="global-search"
              name="q"
              placeholder="Search projects, tasks, people, notes…  ( / )"
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:outline-none"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            {canEdit && (
              <Button size="sm" onClick={() => setTaskOpen(true)} title="New task (n)">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New task</span>
              </Button>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-5 lg:px-8">{children}</main>
      </div>

      {canEdit && <QuickTaskDialog open={taskOpen} onClose={() => setTaskOpen(false)} projects={projects} today={today} />}
    </div>
  );
}

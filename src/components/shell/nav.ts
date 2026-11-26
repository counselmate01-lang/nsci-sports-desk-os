import {
  Bot,
  CalendarDays,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Settings,
  Wallet,
  ClipboardList,
} from "lucide-react";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/reports", label: "Reports", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

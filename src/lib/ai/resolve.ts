import { matchScore, words } from "@/lib/utils";
import type { Project, TaskView } from "@/lib/types";
import type { Workspace } from "@/lib/data/workspace";

/** Finds a project from loose text ("roofing", "badminton roofing", "physio"). */
export function resolveProject(ws: Workspace, text: string | null | undefined): Project | null {
  if (!text?.trim()) return null;
  const t = text.trim().toLowerCase();
  const exact = ws.projects.find(
    (p) => p.name.toLowerCase() === t || p.slug === t || p.id === text || p.aliases.some((a) => a.toLowerCase() === t),
  );
  if (exact) return exact;
  const contains = ws.projects.filter(
    (p) => t.includes(p.name.toLowerCase()) || p.aliases.some((a) => new RegExp(`\\b${escapeRe(a.toLowerCase())}\\b`).test(t)),
  );
  if (contains.length === 1) return contains[0];
  if (contains.length > 1) {
    // prefer the longest alias match ("badminton roofing" over "badminton")
    return contains.sort((a, b) => longestAlias(b, t) - longestAlias(a, t))[0];
  }
  let best: Project | null = null;
  let bestScore = 0;
  for (const p of ws.projects) {
    const s = Math.max(matchScore(p.name, text), ...p.aliases.map((a) => matchScore(a, text)));
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

function longestAlias(p: Project, t: string) {
  return Math.max(0, ...[p.name, ...p.aliases].map((a) => (t.includes(a.toLowerCase()) ? a.length : 0)));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Finds tasks from loose text ("yoga video circulation" -> "Circulate Kartik's video"). */
export function findTasks(ws: Workspace, text: string, opts: { openOnly?: boolean; projectId?: string } = {}): TaskView[] {
  const project = opts.projectId ? null : resolveProject(ws, text);
  const pool = ws.tasks.filter(
    (t) => (!opts.openOnly || t.isOpen || t.status === "TBD") && (!opts.projectId || t.project_id === opts.projectId),
  );
  const scored = pool
    .map((t) => {
      let s = matchScore(text, `${t.title} ${t.projectName}`);
      // Words that are only the project name should not dominate
      if (project && t.project_id === project.id) s += 0.15;
      if (t.title.toLowerCase() === text.toLowerCase()) s += 1;
      return { t, s };
    })
    .filter((x) => x.s >= 0.5)
    .sort((a, b) => b.s - a.s || (a.t.isOpen === b.t.isOpen ? 0 : a.t.isOpen ? -1 : 1));
  return scored.slice(0, 8).map((x) => x.t);
}

export function hasWords(text: string) {
  return words(text).length > 0;
}

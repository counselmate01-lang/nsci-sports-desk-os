import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatINR(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return inr.format(Number(value));
}

export function num(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Lower-case words with punctuation removed, for fuzzy matching. */
export function words(text: string): string[] {
  const STOP = new Set(["the", "a", "an", "of", "to", "for", "and", "with", "on", "in", "as", "is", "my", "task", "please", "mark", "set"]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Rough similarity: how many query words appear (by 5-letter prefix) in the target. */
export function matchScore(query: string, target: string): number {
  const q = words(query);
  if (!q.length) return 0;
  const t = words(target);
  let hits = 0;
  for (const w of q) {
    const stem = w.slice(0, Math.min(5, w.length));
    if (t.some((x) => x.startsWith(stem) || stem.startsWith(x.slice(0, 5)))) hits++;
  }
  return hits / q.length;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

import { addDays } from "@/lib/dates";
import { PRIORITIES, STATUSES, type Priority, type Status } from "@/lib/types";
import type { Workspace } from "@/lib/data/workspace";
import { resolveProject } from "./resolve";

// Rule-based understanding of short commands. Works without any AI key and is
// also used to double-check AI output.

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Finds a date phrase in the text. Returns the ISO date and the matched phrase. */
export function parseDate(text: string, today: string): { date: string; match: string } | null {
  const t = text.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/\b(?:by |on |for )?day after tomorrow\b/))) return { date: addDays(today, 2), match: m[0] };
  if ((m = t.match(/\b(?:by |on |for )?tomorrow\b/))) return { date: addDays(today, 1), match: m[0] };
  if ((m = t.match(/\b(?:by |on |for )?(?:today|tonight|eod)\b/))) return { date: today, match: m[0] };
  if ((m = t.match(/\bin (\d{1,3}) days?\b/))) return { date: addDays(today, Number(m[1])), match: m[0] };
  if ((m = t.match(/\b(?:by |on |for )?next week\b/))) return { date: addDays(today, 7), match: m[0] };
  if ((m = t.match(/\b(?:by |on |for |this |next )?(sun|mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?)(?:day)?\b/))) {
    const idx = WEEKDAYS.findIndex((d) => d.startsWith(m![1].slice(0, 3)));
    const cur = new Date(today + "T00:00:00Z").getUTCDay();
    let diff = (idx - cur + 7) % 7;
    if (diff === 0) diff = 7;
    return { date: addDays(today, diff), match: m[0] };
  }
  if ((m = t.match(/\b(?:by |on )?(\d{4})-(\d{2})-(\d{2})\b/))) return { date: `${m[1]}-${m[2]}-${m[3]}`, match: m[0] };
  if ((m = t.match(/\b(?:by |on )?(\d{1,2})(?:st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/))) {
    return { date: monthDay(Number(m[1]), MONTHS.indexOf(m[2]), today), match: m[0] };
  }
  if ((m = t.match(/\b(?:by |on )?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)?\b/))) {
    return { date: monthDay(Number(m[2]), MONTHS.indexOf(m[1]), today), match: m[0] };
  }
  return null;
}

function monthDay(day: number, monthIdx: number, today: string) {
  let year = Number(today.slice(0, 4));
  const candidate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (candidate < today) year += 1;
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseTime(text: string): { time: string; match: string } | null {
  const m = text.toLowerCase().match(/\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (!m[3] && h >= 1 && h <= 7) h += 12; // "at 5" during work hours means 5 PM
  if (h > 23 || min > 59) return null;
  return { time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`, match: m[0] };
}

export function parsePriority(text: string): { priority: Priority; match: string } | null {
  const m = text.match(/\b(?:priority\s*)?(p[0-3])\b(?:\s*priority)?/i);
  if (m) return { priority: m[1].toUpperCase() as Priority, match: m[0] };
  if (/\burgent\b/i.test(text)) return { priority: "P0", match: "urgent" };
  return null;
}

export function parseStatus(text: string): Status | null {
  const t = text.toLowerCase();
  if (/\bin[ -]?progress\b/.test(t)) return "IN_PROGRESS";
  if (/\b(complete|completed|done|finished)\b/.test(t)) return "COMPLETED";
  if (/\bwaiting\b/.test(t)) return "WAITING";
  if (/\bcancel(?:led)?\b/.test(t)) return "CANCELLED";
  if (/\bpending\b/.test(t)) return "PENDING";
  if (/\btbd\b/.test(t)) return "TBD";
  const up = t.toUpperCase().replace(/\s/g, "_");
  return (STATUSES as readonly string[]).includes(up) ? (up as Status) : null;
}

export interface ParsedTask {
  title: string;
  project_id: string | null;
  project_name: string | null;
  priority: Priority | null;
  status: Status | null;
  due_date: string | null;
  waiting_for: string | null;
  assigned_to: string | null;
}

/** "Add task: Send court repair email tomorrow, priority P0" -> fields */
export function parseTaskSentence(ws: Workspace, sentence: string): ParsedTask {
  let text = sentence.trim().replace(/^(please\s+)?(add|create|new)\s+(a\s+)?task\s*(to\s+)?[:\-–]?\s*/i, "");
  const date = parseDate(text, ws.today);
  if (date) text = text.replace(new RegExp(escape(date.match), "i"), " ");
  const pr = parsePriority(text);
  if (pr) text = text.replace(new RegExp(escape(pr.match), "i"), " ");
  let waiting: string | null = null;
  const w = text.match(/,?\s*waiting (?:for|on) ([^,.]+)/i);
  if (w) {
    waiting = w[1].trim();
    text = text.replace(w[0], " ");
  }
  let assigned: string | null = null;
  const a = text.match(/,?\s*(?:assign(?:ed)? to|owner:?) ([^,.]+)/i);
  if (a) {
    assigned = a[1].trim();
    text = text.replace(a[0], " ");
  }
  let projectText: string | null = null;
  const pm = text.match(/\b(?:for|in|under) (?:the )?project ([^,.]+)/i) ?? text.match(/\((?:project:?\s*)?([^)]+)\)/i);
  if (pm) {
    projectText = pm[1];
    text = text.replace(pm[0], " ");
  }
  const title = text
    .replace(/\s*,\s*(?=,|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.:–-]+|[\s,.:–-]+$/g, "")
    .replace(/\s+(by|on|due)$/i, "");
  const project = resolveProject(ws, projectText ?? sentence);
  return {
    title: title ? title[0].toUpperCase() + title.slice(1) : "",
    project_id: project?.id ?? null,
    project_name: project?.name ?? null,
    priority: pr?.priority ?? null,
    status: waiting ? "WAITING" : null,
    due_date: date?.date ?? null,
    waiting_for: waiting,
    assigned_to: assigned,
  };
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const PRIORITY_VALUES = PRIORITIES;

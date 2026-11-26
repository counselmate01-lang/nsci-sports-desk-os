"use server";

import { revalidatePath } from "next/cache";
import { getActionUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import {
  documentSchema,
  expenseSchema,
  firstError,
  formToObject,
  projectBudgetSchema,
  projectSchema,
  type ActionResult,
} from "@/lib/validation";

const NOT_SIGNED_IN: ActionResult = { ok: false, error: "Your session expired. Please sign in again." };
const READ_ONLY: ActionResult = { ok: false, error: "Your account is view-only. Ask an admin for edit access." };

function refresh() {
  revalidatePath("/", "layout");
}

export async function createProject(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const parsed = projectSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const slug = slugify(parsed.data.name) || `project-${Date.now()}`;
  const { data: last } = await ctx.supabase.from("projects").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await ctx.supabase
    .from("projects")
    .insert({ ...parsed.data, slug, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("slug")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "A project with this name already exists." };
    return { ok: false, error: error.message };
  }
  refresh();
  return { ok: true, id: data.slug, message: "Project created" };
}

export async function updateProject(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const id = String(formData.get("id") ?? "");
  const parsed = projectSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { error } = await ctx.supabase.from("projects").update(parsed.data).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "A project with this name already exists." };
    return { ok: false, error: error.message };
  }
  refresh();
  return { ok: true, message: "Project saved" };
}

export async function updateProjectBudget(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const id = String(formData.get("id") ?? "");
  const parsed = projectBudgetSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { data: project } = await ctx.supabase.from("projects").select("actual_spend").eq("id", id).single();
  const spent = Number(project?.actual_spend ?? 0);
  if (parsed.data.approved_budget !== null && parsed.data.approved_budget !== undefined && parsed.data.approved_budget < spent && formData.get("confirm_negative") !== "yes") {
    return {
      ok: false,
      needsConfirm: true,
      error: `Approved budget is less than what has already been spent (₹${spent.toLocaleString("en-IN")}). Remaining will be negative. Tick the box to save anyway.`,
    };
  }
  const { error } = await ctx.supabase.from("projects").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Budget saved" };
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role !== "admin") return { ok: false, error: "Only an admin can delete a project." };
  const { error, count } = await ctx.supabase.from("projects").delete({ count: "exact" }).eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Project not found." };
  refresh();
  return { ok: true, message: "Project deleted" };
}

// ---------------- Documents ----------------

export async function addDocument(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;

  const raw = formToObject(formData);
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 20 * 1024 * 1024) return { ok: false, error: "Files must be 20 MB or smaller." };
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${raw.project_id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await ctx.supabase.storage.from("documents").upload(path, file, { contentType: file.type || undefined });
    if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}. Has the "documents" storage bucket been created? (see docs/SUPABASE_SETUP.md)` };
    raw.storage_path = path;
    if (!raw.title) raw.title = file.name;
  }

  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const isL1 = formData.get("is_l1") === "on";
  const { error } = await ctx.supabase.from("documents").insert({ ...parsed.data, is_l1: isL1 });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Document added" };
}

export async function markL1(documentId: string): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const { error } = await ctx.supabase.from("documents").update({ is_l1: true }).eq("id", documentId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Marked as L1" };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const { data: doc } = await ctx.supabase.from("documents").select("storage_path").eq("id", documentId).maybeSingle();
  const { error } = await ctx.supabase.from("documents").delete().eq("id", documentId);
  if (error) return { ok: false, error: error.message };
  if (doc?.storage_path) await ctx.supabase.storage.from("documents").remove([doc.storage_path]);
  refresh();
  return { ok: true, message: "Document removed" };
}

/** Short-lived download link for an uploaded file. */
export async function getDocumentLink(documentId: string): Promise<ActionResult & { url?: string }> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  const { data: doc } = await ctx.supabase.from("documents").select("storage_path").eq("id", documentId).maybeSingle();
  if (!doc?.storage_path) return { ok: false, error: "No file attached" };
  const { data, error } = await ctx.supabase.storage.from("documents").createSignedUrl(doc.storage_path, 60 * 10);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create link" };
  return { ok: true, url: data.signedUrl };
}

// ---------------- Expenses ----------------

export async function addExpense(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const parsed = expenseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { data: project } = await ctx.supabase
    .from("projects")
    .select("approved_budget, actual_spend, name")
    .eq("id", parsed.data.project_id)
    .single();
  if (project) {
    const approved = project.approved_budget === null ? null : Number(project.approved_budget);
    const after = Number(project.actual_spend) + parsed.data.amount;
    if (formData.get("confirm_over") !== "yes") {
      if (approved === null) {
        return {
          ok: false,
          needsConfirm: true,
          error: `${project.name} has no approved budget yet. Tick the box to record this spend anyway.`,
        };
      }
      if (after > approved) {
        return {
          ok: false,
          needsConfirm: true,
          error: `This takes ${project.name} over its approved budget by ₹${(after - approved).toLocaleString("en-IN")}. Tick the box to record it anyway.`,
        };
      }
    }
  }
  const { error } = await ctx.supabase.from("expenses").insert(parsed.data);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Spend recorded" };
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const { error } = await ctx.supabase.from("expenses").delete().eq("id", expenseId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Spend removed" };
}

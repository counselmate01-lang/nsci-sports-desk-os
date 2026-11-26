import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { loadWorkspace } from "./workspace";

/** Loads the workspace once per page request (shared by layout + page). */
export const getWorkspace = cache(async () => {
  const { supabase } = await requireUser();
  return loadWorkspace(supabase);
});

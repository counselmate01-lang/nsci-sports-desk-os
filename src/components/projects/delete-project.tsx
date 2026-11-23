"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteProject } from "@/app/actions/projects";

export function DeleteProjectButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <ConfirmButton
        size="sm"
        variant="ghost"
        confirmLabel="Delete project and all its tasks?"
        onConfirm={async () => {
          const r = await deleteProject(id);
          if (r.ok) router.push("/projects");
          else setError(r.error);
        }}
      >
        Delete project
      </ConfirmButton>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

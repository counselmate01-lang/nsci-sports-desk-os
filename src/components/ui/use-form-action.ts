"use client";

import * as React from "react";
import type { ActionResult } from "@/lib/validation";

/**
 * Like React's useActionState, but keeps what the user typed when the server
 * returns an error (React otherwise clears the form after every submit).
 * Usage: const [state, onSubmit, pending] = useFormAction(serverAction);  <form onSubmit={onSubmit}>
 */
export function useFormAction<S extends ActionResult | { error?: string; message?: string } | null>(
  action: (prev: S | null, formData: FormData) => Promise<S>,
) {
  const [state, setState] = React.useState<S | null>(null);
  const [pending, start] = React.useTransition();
  const onSubmit = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.name) fd.set(submitter.name, submitter.value);
      start(async () => {
        const result = await action(state, fd);
        setState(result);
      });
    },
    [action, state],
  );
  return [state, onSubmit, pending] as const;
}

"use client";

import * as React from "react";
import { Button, type ButtonProps } from "./button";

/** Two-step button for destructive actions: first click asks, second click does it. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Click again to confirm",
  ...props
}: Omit<ButtonProps, "onClick"> & { onConfirm: () => Promise<unknown> | void; confirmLabel?: string }) {
  const [asking, setAsking] = React.useState(false);
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(t);
  }, [asking]);
  return (
    <Button
      {...props}
      variant={asking ? "danger" : props.variant}
      disabled={pending || props.disabled}
      onClick={() => {
        if (!asking) return setAsking(true);
        setAsking(false);
        start(async () => {
          await onConfirm();
        });
      }}
    >
      {pending ? "Working…" : asking ? confirmLabel : children}
    </Button>
  );
}

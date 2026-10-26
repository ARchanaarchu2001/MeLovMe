"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";
import Spinner from "./Spinner";

// Submit button for a plain <form action={serverAction}>: shows a spinner and
// disables itself while the action runs.
export default function PendingButton({ children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" {...props} disabled={pending || disabled} aria-busy={pending}>
      {pending && <Spinner />}
      {children}
    </button>
  );
}

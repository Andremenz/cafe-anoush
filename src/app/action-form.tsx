"use client";

import { useActionState, type ReactNode } from "react";

export type ActionState = { error?: string } | null;
type FormAction = (previous: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className} aria-busy={pending}>
      {children}
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

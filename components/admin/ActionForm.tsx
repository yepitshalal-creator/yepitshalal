'use client';

import type { ReactNode } from 'react';
import { useFormState } from 'react-dom';
import type { ActionState } from '@/lib/admin/action-state';

/** A form whose server action answers in words, shown under what it holds. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-halal-partialInk">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="mt-3 text-sm font-medium text-halal-fullInk">
          {state.ok}
        </p>
      )}
    </form>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";

export interface FormState {
  error?: string;
  message?: string;
}

/**
 * Sends a form to a server action. Unlike `<form action>`, React doesn't reset the fields
 * afterwards, so what was typed stays after a validation error. `onSaved` runs after success;
 * `clear` hides the last message, e.g. as soon as something changes again.
 */
export function useSubmit(action: (prev: FormState, form: FormData) => Promise<FormState>, onSaved?: (form: HTMLFormElement) => void) {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setState({});
    start(async () => {
      // An action that redirects never returns a result.
      const result = (await action({}, data)) ?? {};
      setState(result);
      if (!result.error) onSaved?.(form);
    });
  }

  return { state, pending, onSubmit, clear: () => setState((s) => (s.error || s.message ? {} : s)) };
}

/**
 * `useLoginForm` — the login form's state, validation and submit plumbing, in one hook.
 *
 * The component that renders the fields gets `control` and three booleans. It never sees the schema, a
 * resolver, or `handleSubmit` — which is what keeps [Rule 2](../../../../CLAUDE.md) true at the
 * component level rather than only at the route level.
 *
 * ## `mode: 'onTouched'`
 *
 * Not `onChange`, which tells someone their address is invalid on the second keystroke and keeps
 * telling them until the moment it becomes valid — the message is wrong for the entire time it is
 * visible. Not `onSubmit` either, which makes the user press the button to discover a typo. `onTouched`
 * validates when a field is left and on every change *after* that, so the first message arrives when
 * the user has finished the thought, and corrections are then confirmed live.
 *
 * ## Why `submit` is `() => void`
 *
 * `handleSubmit(fn)` returns a promise, and a `Button`'s `onPress` is synchronous, so passing it
 * straight through leaves a floating promise — which `@typescript-eslint/no-floating-promises` flags
 * and, more to the point, means a rejection inside the handler disappears. `void` here is the explicit
 * statement that the promise is handled inside `onSubmit`, not dropped: RHF catches a throwing
 * submit handler, holds `isSubmitting` correctly across it, and re-throws nothing.
 *
 * ## What is deliberately missing: the network call
 *
 * `onSubmit` is a parameter. There is no `src/core/auth` and no `api/repository.ts` in this feature
 * yet, so this hook cannot sign anyone in and does not pretend to — it validates, it reports, and it
 * hands the values to whatever the caller does next. When the repository lands, the change is inside
 * the callback the route passes; nothing here moves.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { loginSchema } from './schemas';

import type { Control } from 'react-hook-form';
import type { LoginValues } from './schemas';

export interface LoginFormApi {
  readonly control: Control<LoginValues>;
  /** Drives the submit button's disabled state — the reference screen's "Continue" is inert until valid. */
  readonly isValid: boolean;
  readonly isSubmitting: boolean;
  readonly submit: () => void;
}

export function useLoginForm(
  onSubmit: (values: LoginValues) => Promise<void> | void
): LoginFormApi {
  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    // Empty strings rather than `undefined`, so every field is controlled from the first render. An
    // uncontrolled-then-controlled `TextInput` loses its first keystroke on Android.
    defaultValues: { email: '', password: '' },
  });

  const submit = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  return { control, isValid, isSubmitting, submit };
}

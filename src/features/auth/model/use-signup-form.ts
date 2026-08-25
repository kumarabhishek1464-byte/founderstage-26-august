/**
 * `useSignupForm` — the same contract as [`useLoginForm`](./use-login-form.ts) against the signup
 * schema, which has two fields the login form does not: a confirmation and a terms checkbox.
 *
 * The two hooks are separate rather than one generic `useCredentialForm<T>` because they only look
 * alike. The schemas differ (login checks presence, signup checks the policy), the default values
 * differ, and a generic version would take the schema and the defaults as parameters — at which point
 * it is `useForm` again with an extra layer, and every call site has to know the resolver anyway.
 * Two named hooks say what each form is. See [Rule 1](../../../../CLAUDE.md): the rule is about not
 * creating a *second* version of one thing, and these are two things.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { signupSchema } from './schemas';

import type { Control } from 'react-hook-form';
import type { SignupValues } from './schemas';

export interface SignupFormApi {
  readonly control: Control<SignupValues>;
  readonly isValid: boolean;
  readonly isSubmitting: boolean;
  readonly submit: () => void;
}

export function useSignupForm(
  onSubmit: (values: SignupValues) => Promise<void> | void
): SignupFormApi {
  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '', confirmPassword: '', acceptedTerms: false },
  });

  const submit = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  return { control, isValid, isSubmitting, submit };
}

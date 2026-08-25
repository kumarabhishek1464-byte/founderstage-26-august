/**
 * The verification step's form state. Same shape as
 * [`useAboutYouForm`](./use-about-you-form.ts) — including why the draft is read without subscribing —
 * and a second hook for the same reason the two auth forms are two hooks: a generic
 * `useDraftStep<TSchema>` would be a wrapper whose only job is to hide which schema and which store
 * action are in play, which is the part of the code a reader most needs to see.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { useOnboardingStore } from './draft-store';
import { verificationSchema } from './schemas';

import type { Control } from 'react-hook-form';
import type { VerificationValues } from './schemas';

export interface VerificationFormApi {
  readonly control: Control<VerificationValues>;
  readonly isValid: boolean;
  readonly submit: () => void;
}

export function useVerificationForm(onValid: () => void): VerificationFormApi {
  const setVerification = useOnboardingStore((state) => state.setVerification);
  const initial = useOnboardingStore.getState().draft;

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<VerificationValues>({
    resolver: zodResolver(verificationSchema),
    mode: 'onTouched',
    defaultValues: {
      website: initial.website,
      linkedin: initial.linkedin,
      twitter: initial.twitter,
      about: initial.about,
    },
  });

  const submit = useCallback(() => {
    void handleSubmit((values) => {
      setVerification(values);
      onValid();
    })();
  }, [handleSubmit, setVerification, onValid]);

  return { control, isValid, submit };
}

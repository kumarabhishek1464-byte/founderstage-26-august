/**
 * The "about you" step's form state.
 *
 * ## Why the defaults are read without subscribing
 *
 * `useOnboardingStore.getState()` rather than `useOnboardingStore(selector)`. The draft is needed exactly
 * once — to seed the fields when the user walks back into this step — and subscribing to it would re-render
 * the whole step on every keystroke of the *next* step for a value that `useForm` already stopped reading
 * after mount. This is the one place a non-reactive read of a store is the correct one.
 *
 * ## Why the store write happens here and not in the screen
 *
 * `submit` commits to the draft and *then* calls the caller's handler, so a route can never navigate
 * forward without the answers having been saved — the ordering is a property of this hook rather than a
 * convention the next screen author has to remember.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { useOnboardingStore } from './draft-store';
import { aboutYouSchema } from './schemas';

import type { Control } from 'react-hook-form';
import type { AboutYouValues } from './schemas';

export interface AboutYouFormApi {
  readonly control: Control<AboutYouValues>;
  readonly isValid: boolean;
  readonly submit: () => void;
}

export function useAboutYouForm(onValid: () => void): AboutYouFormApi {
  const setAboutYou = useOnboardingStore((state) => state.setAboutYou);
  const initial = useOnboardingStore.getState().draft;

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<AboutYouValues>({
    resolver: zodResolver(aboutYouSchema),
    mode: 'onTouched',
    defaultValues: {
      name: initial.name,
      mobile: initial.mobile,
      whatsapp: initial.whatsapp,
      city: initial.city,
    },
  });

  const submit = useCallback(() => {
    void handleSubmit((values) => {
      setAboutYou(values);
      onValid();
    })();
  }, [handleSubmit, setAboutYou, onValid]);

  return { control, isValid, submit };
}

/**
 * `LoginView` — email, password, and the two ways out of the form.
 *
 * ## Why "Continue" is inert until the form validates
 *
 * A disabled primary action is usually the wrong pattern: it gives the user nothing to press and no
 * explanation, so they cannot discover what is missing. It works here because of `mode: 'onTouched'` in
 * [`useLoginForm`](../model/use-login-form.ts) — each field reports as it is left, so by the time the
 * button is in reach the user has already been told what is wrong and where. The disabled state then
 * means "not yet", which is true, and `accessibilityState.disabled` says so out loud.
 *
 * ## Why tapping an unbuilt affordance says so
 *
 * "Continue with Google" and "Forgot password?" are on the reference screen and they are not built —
 * there is no OAuth provider configured and no password-reset route. The three options were to hide
 * them, to leave them inert, or to answer honestly; a control that does *nothing* on press is the worst
 * of the three, because the user cannot tell a missing feature from a broken build. So they answer, in a
 * `Banner`, in plain language. The screen stays the shape the design asks for and nothing pretends to
 * work.
 *
 * ## What is deliberately missing
 *
 * Nothing here authenticates anybody. `onSubmit` is a prop, and it is navigation until `src/core/auth`
 * and this feature's `api/repository.ts` exist — the Supabase client is not reachable from a component
 * at all ([ADR-0011](../../../../docs/adr/0011-repository-pattern.md)), which is what keeps that
 * boundary honest rather than aspirational.
 */
import { useCallback, useState } from 'react';
import { Controller } from 'react-hook-form';

import {
  Banner,
  Button,
  createStyles,
  Stack,
  Text,
  TextField,
  TextLink,
  Wordmark,
} from '@/core/design-system';

import { useLoginForm } from '../model/use-login-form';
import { OrDivider } from './OrDivider';

import type { LoginValues } from '../model/schemas';

interface LoginViewProps {
  readonly onSubmit: (values: LoginValues) => Promise<void> | void;
  readonly onSignup: () => void;
}

/**
 * Written once, used by both unbuilt affordances. Sentence case and no jargon: "the auth layer" is a
 * true description of what is missing and a meaningless one to the person reading it.
 */
const GOOGLE_NOTICE = 'Signing in with Google is not available in this build yet.';
const RESET_NOTICE = 'Password reset is not available in this build yet.';

const useStyles = createStyles(() => ({
  /** Overrides `TextLink`'s own `flex-start`, so "Forgot password?" sits under the field's right edge. */
  alignEnd: { alignSelf: 'flex-end' },
}));

export function LoginView({ onSubmit, onSignup }: LoginViewProps) {
  const styles = useStyles();
  const { control, isValid, isSubmitting, submit } = useLoginForm(onSubmit);

  const [notice, setNotice] = useState<string | undefined>(undefined);

  const showGoogleNotice = useCallback(() => {
    setNotice(GOOGLE_NOTICE);
  }, []);
  const showResetNotice = useCallback(() => {
    setNotice(RESET_NOTICE);
  }, []);

  return (
    <Stack gap="xl2">
      <Wordmark />

      <Stack gap="xxs">
        <Text variant="title1" tone="heading">
          Welcome to FounderStage
        </Text>
        <Text variant="body" tone="secondary">
          Log in or sign up to continue.
        </Text>
      </Stack>

      {notice === undefined ? null : <Banner tone="info" message={notice} />}

      <Stack gap="lg">
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              label="Email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              icon="email"
              placeholder="you@company.com"
              keyboardType="email"
              autofill="email"
              autoCapitalize="none"
            />
          )}
        />

        <Stack gap="xs">
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <TextField
                label="Password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                icon="password"
                placeholder="Enter your password"
                secure
                autofill="password"
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            )}
          />
          <TextLink
            label="Forgot password?"
            variant="footnote"
            tone="secondary"
            onPress={showResetNotice}
            style={styles.alignEnd}
          />
        </Stack>
      </Stack>

      <Stack gap="lg">
        <Button
          label="Continue"
          size="lg"
          fullWidth
          disabled={!isValid}
          loading={isSubmitting}
          onPress={submit}
        />
        <OrDivider />
        <Button
          label="Continue with Google"
          variant="secondary"
          size="lg"
          fullWidth
          onPress={showGoogleNotice}
        />
      </Stack>

      <Stack direction="row" justify="center" align="baseline" gap="xxs">
        <Text variant="footnote" tone="secondary">
          Don&apos;t have an account?
        </Text>
        <TextLink label="Sign up" onPress={onSignup} />
      </Stack>
    </Stack>
  );
}

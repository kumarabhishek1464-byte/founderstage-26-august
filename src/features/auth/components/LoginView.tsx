/**
 * `LoginView` — email, password, and social sign-in matching reference screen 2.
 */
import { useCallback, useState } from 'react';
import { Controller } from 'react-hook-form';

import {
  Banner,
  Button,
  createStyles,
  GoogleIcon,
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

const GOOGLE_NOTICE = 'Signing in with Google is not available in this build yet.';
const RESET_NOTICE = 'Password reset is not available in this build yet.';

const useStyles = createStyles((t) => ({
  alignEnd: {
    alignSelf: 'flex-end',
  },
  googleButton: {
    backgroundColor: t.colors.surface.primary,
    borderColor: t.colors.border.subtle,
  },
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
      <Stack gap="xl">
        <Wordmark />

        <Stack gap="xxs">
          <Text variant="title1" tone="heading">
            Welcome to Circle
          </Text>
          <Text variant="title2" tone="tertiary">
            Log in or sign up{'\n'}to continue
          </Text>
        </Stack>
      </Stack>

      {notice === undefined ? null : <Banner tone="info" message={notice} />}

      <Stack gap="lg">
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              label="Email address"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              icon="email"
              placeholder="you@example.com"
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
          variant="primary"
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
          iconLeft={<GoogleIcon size={20} />}
          style={styles.googleButton}
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

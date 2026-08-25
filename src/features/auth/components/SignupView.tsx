/**
 * `SignupView` — email, password, confirmation, terms checkbox matching reference screen 3.
 */
import { useCallback, useState } from 'react';
import { Controller } from 'react-hook-form';

import {
  Banner,
  Button,
  Checkbox,
  createStyles,
  GoogleIcon,
  Stack,
  Text,
  TextField,
  TextLink,
  Wordmark,
} from '@/core/design-system';

import { PASSWORD_RULE_HINT } from '../model/schemas';
import { useSignupForm } from '../model/use-signup-form';
import { OrDivider } from './OrDivider';

import type { SignupValues } from '../model/schemas';

interface SignupViewProps {
  readonly onSubmit: (values: SignupValues) => Promise<void> | void;
  readonly onLogin: () => void;
}

const GOOGLE_NOTICE = 'Signing up with Google is not available in this build yet.';

const useStyles = createStyles((t) => ({
  googleButton: {
    backgroundColor: t.colors.surface.primary,
    borderColor: t.colors.border.subtle,
  },
}));

export function SignupView({ onSubmit, onLogin }: SignupViewProps) {
  const styles = useStyles();
  const { control, isValid, isSubmitting, submit } = useSignupForm(onSubmit);

  const [notice, setNotice] = useState<string | undefined>(undefined);
  const showGoogleNotice = useCallback(() => {
    setNotice(GOOGLE_NOTICE);
  }, []);

  return (
    <Stack gap="xl2">
      <Stack gap="xl">
        <Wordmark />

        <Stack gap="xxs">
          <Text variant="title1" tone="heading">
            Create your account
          </Text>
          <Text variant="title2" tone="tertiary">
            to join the network
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
              placeholder="Create a password"
              helper={PASSWORD_RULE_HINT}
              helperIcon="verified"
              secure
              autofill="newPassword"
              autoCapitalize="none"
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <TextField
              label="Confirm password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              icon="password"
              placeholder="Confirm your password"
              secure
              autofill="off"
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          )}
        />
      </Stack>

      <Stack gap="lg">
        <Controller
          control={control}
          name="acceptedTerms"
          render={({ field, fieldState }) => (
            <Checkbox
              checked={field.value}
              onChange={field.onChange}
              label="By signing up, you agree to our terms of use and privacy policy."
              error={fieldState.error?.message}
            />
          )}
        />

        <Button
          label="Create account"
          size="lg"
          variant="primary"
          fullWidth
          disabled={!isValid}
          loading={isSubmitting}
          onPress={submit}
        />
        <OrDivider />
        <Button
          label="Sign up with Google"
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
          Already have an account?
        </Text>
        <TextLink label="Log in" tone="accent" onPress={onLogin} />
      </Stack>
    </Stack>
  );
}

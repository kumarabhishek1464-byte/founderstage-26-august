/**
 * `SignupView` — email, a password typed twice, and an explicit agreement.
 *
 * ## Why the terms are a checkbox here and a sentence on the welcome screen
 *
 * `WelcomeView` carries [`LegalNote`](./LegalNote.tsx): "by proceeding, you agree" — *implied* consent,
 * which is all a screen with no account creation on it can claim. This screen creates the account, so the
 * consent is explicit and it is a control the user has to set. Adding the implied-consent line underneath
 * as well would be saying the same thing twice, in two strengths, one of which is now false.
 *
 * [`Checkbox`](../../../core/design-system/components/Checkbox.tsx) refuses a `ReactNode` label because
 * nesting a link inside a checkbox is a broken control, and points at this screen to render "a short label
 * and the linked sentence beneath". There is no `/legal/terms` route to link to yet, so the label carries
 * the whole phrase and there is no second line; when those routes exist, the label shortens to "I agree to
 * the terms" and the linked sentence appears below it, exactly as that docblock describes.
 *
 * ## Why the password rule is a helper and not an error
 *
 * The rule is stated under the field *before* the user types, as `helper` with a shield glyph. A rule the
 * user only meets as a red error after failing it is a rule the interface withheld — and since the same
 * sentence is the schema's message
 * ([`PASSWORD_RULE_HINT`](../model/schemas.ts)), the advice and the complaint are guaranteed to be the
 * same words rather than two paraphrases of one policy.
 *
 * ## What is deliberately missing
 *
 * No account is created. `onSubmit` is a prop and it is navigation until `src/core/auth` and this
 * feature's `api/repository.ts` exist; a component cannot reach the Supabase client at all
 * ([ADR-0011](../../../../docs/adr/0011-repository-pattern.md)).
 */
import { useCallback, useState } from 'react';
import { Controller } from 'react-hook-form';

import {
  Banner,
  Button,
  Checkbox,
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

export function SignupView({ onSubmit, onLogin }: SignupViewProps) {
  const { control, isValid, isSubmitting, submit } = useSignupForm(onSubmit);

  const [notice, setNotice] = useState<string | undefined>(undefined);
  const showGoogleNotice = useCallback(() => {
    setNotice(GOOGLE_NOTICE);
  }, []);

  return (
    <Stack gap="xl2">
      <Wordmark />

      <Stack gap="xxs">
        <Text variant="title1" tone="heading">
          Create your account
        </Text>
        <Text variant="body" tone="secondary">
          Join a curated network of founders, investors and operators.
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
              // `verified` is the shield-with-a-check. A password *rule* is a reassurance, not a status,
              // so the glyph is the one that reads "this is how we keep the account safe".
              helperIcon="verified"
              secure
              // `newPassword`, not `password`: this is what tells the platform's keychain to *offer* a
              // strong password rather than to look for a saved one it cannot have.
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
              placeholder="Re-enter your password"
              secure
              // Autofill is off on the confirmation on purpose: a keychain filling both boxes makes them
              // match without the user ever having typed the password they will need next time.
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
              label="I agree to the terms of use and privacy policy"
              error={fieldState.error?.message}
            />
          )}
        />

        <Button
          label="Create account"
          size="lg"
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
          onPress={showGoogleNotice}
        />
      </Stack>

      <Stack direction="row" justify="center" align="baseline" gap="xxs">
        <Text variant="footnote" tone="secondary">
          Already have an account?
        </Text>
        <TextLink label="Log in" onPress={onLogin} />
      </Stack>
    </Stack>
  );
}

/**
 * Step 4 — the evidence. One required link, two optional ones, a sentence, and a file the app cannot yet
 * accept.
 *
 * ## Why LinkedIn is first, and the reference screen's order is not kept
 *
 * The reference leads with Website and puts LinkedIn second. This screen leads with LinkedIn because it is
 * the only required field on it: the point of the step is verification, LinkedIn is the evidence a reviewer
 * actually checks, and a user who has to scroll past two optional fields to find the one thing standing
 * between them and the button has been made to work for no reason. The three links still sit together, in
 * the order a reviewer would open them.
 *
 * ## Why the dropzone is inert
 *
 * [`FileDropzone`](../../../core/design-system/components/FileDropzone.tsx) is rendered without `onPress`,
 * which makes it a labelled, dimmed, unpressable zone rather than a control that opens a picker. That is
 * deliberate and it is not a stub left behind: there is no storage bucket, no `src/core/database`, and
 * CLAUDE.md requires MIME **and** size validation *server-side* — none of which exists. Adding
 * `expo-document-picker` today would buy a file the app has nowhere to put and no way to check, and it
 * fails question 6 of the seven in `docs/CONTRIBUTING.md`.
 *
 * It is on the screen because the field is part of the design and because "optional" is honest about it: a
 * user can complete this step without it, exactly as they will be able to when it works.
 *
 * ## Why the reassurance is a banner and not helper text
 *
 * "We only use these to verify you" is a statement about all four fields, not about one of them, and helper
 * text repeated four times is noise. It also sits *below* the fields rather than above: a promise made
 * before the user has seen what is being asked for is a promise about nothing.
 */
import { Controller } from 'react-hook-form';

import { Banner, FileDropzone, Stack, TextField } from '@/core/design-system';

import { ABOUT_MAX_LENGTH } from '../model/schemas';
import { useVerificationForm } from '../model/use-verification-form';
import { OnboardingLayout } from './OnboardingLayout';

interface VerificationViewProps {
  readonly onBack: () => void;
  readonly onSubmit: () => void;
}

export function VerificationView({ onBack, onSubmit }: VerificationViewProps) {
  const { control, isValid, submit } = useVerificationForm(onSubmit);

  return (
    <OnboardingLayout
      step={4}
      title="Help us verify you"
      subtitle="A reviewer checks every profile before it joins the network."
      onBack={onBack}
      onContinue={submit}
      canContinue={isValid}
      ctaLabel="Submit for review"
    >
      <Stack gap="lg">
        <Controller
          control={control}
          name="linkedin"
          render={({ field, fieldState }) => (
            <TextField
              label="LinkedIn profile"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              icon="link"
              placeholder="linkedin.com/in/priyasharma"
              keyboardType="url"
              autofill="url"
              autoCapitalize="none"
            />
          )}
        />

        <Controller
          control={control}
          name="website"
          render={({ field, fieldState }) => (
            <TextField
              label="Website"
              optional
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              icon="website"
              placeholder="founderstage.com"
              keyboardType="url"
              autofill="url"
              autoCapitalize="none"
            />
          )}
        />

        <Controller
          control={control}
          name="twitter"
          render={({ field, fieldState }) => (
            <TextField
              label="X / Twitter"
              optional
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              icon="atSign"
              placeholder="@priyasharma"
              keyboardType="url"
              autofill="off"
              autoCapitalize="none"
            />
          )}
        />

        <Controller
          control={control}
          name="about"
          render={({ field, fieldState }) => (
            <TextField
              label="About you"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              placeholder="Founder at ABC Labs, building payments infrastructure for small businesses."
              helper="One or two sentences. This is the first thing other members read."
              multiline
              maxLength={ABOUT_MAX_LENGTH}
              autoCapitalize="sentences"
            />
          )}
        />

        <FileDropzone label="Upload proof" optional hint="PDF, PPT, DOC, PNG or JPG. Max 10 MB." />

        <Banner
          icon="verified"
          title="Your details stay with the review team"
          message="We use these to confirm who you are. Nothing here is published to your profile without your say-so."
        />
      </Stack>
    </OnboardingLayout>
  );
}

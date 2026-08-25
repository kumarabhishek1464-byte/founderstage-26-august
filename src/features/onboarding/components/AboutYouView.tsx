/**
 * Step 1 — who we are talking to. Name, how to reach them, where they are.
 *
 * ## Why this step is first, and why it is this short
 *
 * Four fields, three of them one tap or one word. The first step of an onboarding flow is where people
 * leave, so it asks for the things a person can answer without looking anything up — and none of it is
 * the interesting part of the profile. The interesting part is two steps away, by which point they have
 * already invested something.
 *
 * ## Why WhatsApp is a separate optional field
 *
 * The last step tells the user their verification result arrives by email *and* WhatsApp, and in this
 * market those are routinely different numbers. Prefilling it from the mobile number would be the app
 * assuming, and defaulting it to empty with a helper line is the version that gets it right for the people
 * where it matters and costs everyone else one glance.
 *
 * ## Why the dialling code is a prefix and not part of the value
 *
 * `+91` is `TextField`'s `prefix` — an immutable leading run the user cannot delete and does not have to
 * type. It keeps the value ten digits, which is what the schema checks and what the column will hold; a
 * field where the country code is sometimes present and sometimes not is a field that needs normalising
 * on the way in and on the way out forever.
 */
import { Controller } from 'react-hook-form';

import { Select, Stack, TextField } from '@/core/design-system';

import { CITY_OPTIONS } from '../model/options';
import { NAME_MAX_LENGTH } from '../model/schemas';
import { useAboutYouForm } from '../model/use-about-you-form';
import { OnboardingLayout } from './OnboardingLayout';

interface AboutYouViewProps {
  readonly onBack: () => void;
  readonly onContinue: () => void;
}

/** Ten digits plus room for the two spaces people type inside a phone number. */
const MOBILE_MAX_LENGTH = 12;

export function AboutYouView({ onBack, onContinue }: AboutYouViewProps) {
  const { control, isValid, submit } = useAboutYouForm(onContinue);

  return (
    <OnboardingLayout
      step={1}
      title="Let's get you set up"
      subtitle="Tell us a bit about you so we can personalise what you see."
      onBack={onBack}
      onContinue={submit}
      canContinue={isValid}
      footnote="You can update any of this later from your profile settings."
    >
      <Stack gap="lg">
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField
              label="Your name"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              icon="profile"
              placeholder="Priya Sharma"
              autofill="name"
              autoCapitalize="words"
              maxLength={NAME_MAX_LENGTH}
            />
          )}
        />

        <Controller
          control={control}
          name="mobile"
          render={({ field, fieldState }) => (
            <TextField
              label="Mobile number"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              icon="phone"
              prefix="+91"
              placeholder="98765 43210"
              keyboardType="phone"
              autofill="tel"
              maxLength={MOBILE_MAX_LENGTH}
            />
          )}
        />

        <Controller
          control={control}
          name="whatsapp"
          render={({ field, fieldState }) => (
            <TextField
              label="WhatsApp number"
              optional
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              icon="chat"
              prefix="+91"
              placeholder="98765 43210"
              helper="Only if it is different from your mobile number."
              keyboardType="phone"
              // Autofill off: the platform would offer the same number it just filled above, which is
              // the one case where this field should stay empty.
              autofill="off"
              maxLength={MOBILE_MAX_LENGTH}
            />
          )}
        />

        <Controller
          control={control}
          name="city"
          render={({ field, fieldState }) => (
            <Select
              label="City"
              value={field.value}
              onChange={field.onChange}
              options={CITY_OPTIONS}
              error={fieldState.error?.message}
              icon="location"
              placeholder="Select your city"
              sheetTitle="Where are you based?"
            />
          )}
        />
      </Stack>
    </OnboardingLayout>
  );
}

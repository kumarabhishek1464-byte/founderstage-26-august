/**
 * `AboutYouView` — Step 1 matching reference screen 4.
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

const MOBILE_MAX_LENGTH = 12;

export function AboutYouView({ onBack, onContinue }: AboutYouViewProps) {
  const { control, isValid, submit } = useAboutYouForm(onContinue);

  return (
    <OnboardingLayout
      step={1}
      title="Let's get you set up"
      subtitle="Tell us a bit about you to personalize your experience"
      onBack={onBack}
      onContinue={submit}
      canContinue={isValid}
      footnote="You can always update this later from your profile settings."
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
              placeholder="Enter your name"
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
              placeholder="Enter your mobile number"
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
              label="WhatsApp number (optional)"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              icon="chat"
              prefix="+91"
              placeholder="Enter your WhatsApp number"
              helper="We'll use this to keep you updated on important things."
              keyboardType="phone"
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
              placeholder="Enter your city"
              sheetTitle="Where are you based?"
            />
          )}
        />
      </Stack>
    </OnboardingLayout>
  );
}

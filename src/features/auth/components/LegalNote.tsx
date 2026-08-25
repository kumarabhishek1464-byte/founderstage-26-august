/**
 * `LegalNote` — the footer line explaining agreement to terms and privacy policy.
 */
import { Stack, Text } from '@/core/design-system';

interface LegalNoteProps {
  /** The user's action, lowercase, as it reads mid-sentence: "proceeding", "signing up". */
  readonly action?: string;
}

export function LegalNote({ action = 'proceeding' }: LegalNoteProps) {
  return (
    <Stack align="center" justify="center">
      <Text variant="caption" tone="tertiary" align="center">
        {`By ${action}, you agree to `}
        <Text variant="caption" tone="secondary" style={{ textDecorationLine: 'underline' }}>
          terms of use
        </Text>
        {'\nand '}
        <Text variant="caption" tone="secondary" style={{ textDecorationLine: 'underline' }}>
          privacy policy
        </Text>
      </Text>
    </Stack>
  );
}

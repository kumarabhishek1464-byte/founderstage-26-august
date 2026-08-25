/**
 * `LegalNote` — the line under an auth control that says continuing means agreeing.
 *
 * ## Why "terms of use" and "privacy policy" are not links
 *
 * They are underlined links in the reference, and here they are plain text, because **there is no terms
 * route and no privacy route in this app**. A styled, tappable phrase that does nothing is worse than
 * unstyled text that does nothing: the user who taps it learns the interface lies, and the one who
 * relies on it never reads what they agreed to. Emphasis is left off for the same reason — bold or
 * underlined prose in a legal line reads as "tap me" whether or not a handler is attached.
 *
 * This is deliberately one line to change. When `/legal/terms` and `/legal/privacy` exist, the sentence
 * becomes three `Text` runs and two `TextLink`s in a wrapped row, and nothing else about the screens
 * moves.
 *
 * ## Why the copy is a prop
 *
 * "By continuing, you agree…" is right above a button that says Continue and wrong above one that says
 * Create account. The sentence has to name what the user is actually doing, so the caller supplies the
 * verb rather than every screen carrying the same slightly-wrong sentence.
 */
import { Text } from '@/core/design-system';

interface LegalNoteProps {
  /** The user's action, lowercase, as it reads mid-sentence: "proceeding", "creating an account". */
  readonly action: string;
}

export function LegalNote({ action }: LegalNoteProps) {
  return (
    <Text variant="caption" tone="tertiary" align="center">
      {`By ${action}, you agree to our terms of use and privacy policy.`}
    </Text>
  );
}

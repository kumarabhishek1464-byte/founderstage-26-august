/**
 * Validation for the two credential forms, as schemas rather than as code inside a component.
 *
 * [Rule 2](../../../../CLAUDE.md) is explicit that a screen contains no "validation schema
 * evaluation", and this is the other half of that rule: the schema is the *only* place a rule about a
 * password is written down. A form component reads `error` off a field and renders it. Nothing composes
 * a message, and nothing decides what counts as valid twice.
 *
 * ## The messages live here, and they are the copy
 *
 * A message next to a field is product writing, so it is written as product writing: what to do, not
 * what went wrong. "Enter your email address", never "email is required" — the second one is a
 * developer describing a schema to a user. Keeping them in the schema is what makes them reviewable as
 * a set; scattered across components, the voice drifts within a release.
 *
 * These are ours, so they are literals. Anything arriving from Supabase or Postgres is a different
 * class of thing entirely and never reaches a user unnormalised — `AppError.userMessage`,
 * [ADR-0015](../../../../docs/adr/0015-error-model.md).
 *
 * ## Why the email check is a regex and not `z.email()`
 *
 * Zod has moved this API twice — `z.string().email()` in v3, deprecated in favour of a top-level
 * `z.email()` in v4 — and a schema file is the wrong place to be tracking that. The regex below is also
 * closer to what a client should actually assert: it rejects the shapes a user obviously mistyped
 * (missing `@`, no dot, a trailing space) and does not attempt RFC 5322, because the only real proof
 * that an address exists is a message arriving at it. Over-strict client validation on email is a
 * support ticket, not a safeguard.
 */
import { z } from 'zod';

/**
 * One `@`, at least one dot after it, and no whitespace anywhere. Deliberately permissive about
 * everything else — see above. The `u` flag is required by the project's ESLint config for every
 * regex, so it is on every pattern in this file.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

/**
 * Eight, which is the floor Supabase Auth itself enforces by default. Named rather than inlined
 * because the number appears in the rule *and* in the helper text under the field, and the two must
 * not be able to disagree.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Letters and digits, not "a mix of letters, numbers & symbols".
 *
 * The reference screen asks for symbols and this does not, because a rule that is stated has to be a
 * rule that is enforced — helper text promising a requirement the schema does not check is the kind of
 * small dishonesty that teaches users to ignore all of it. Two character classes plus a length floor is
 * also where the evidence points: composition rules past that push users towards `Password1!` and
 * towards writing it down (NIST SP 800-63B §5.1.1.2 argues against composition rules for exactly this
 * reason). Length is the property that matters, and the field accepts a passphrase happily.
 */
const HAS_LETTER = /[a-zA-Z]/u;
const HAS_DIGIT = /[0-9]/u;

/** The one string that states the password rule, used by the schema and by the field's helper text. */
export const PASSWORD_RULE_HINT = `At least ${String(PASSWORD_MIN_LENGTH)} characters, including a letter and a number.`;

const emailField = z
  .string()
  .min(1, 'Enter your email address')
  .regex(EMAIL_PATTERN, 'That does not look like an email address');

export const loginSchema = z.object({
  email: emailField,
  /**
   * Presence only. The rules below apply to *choosing* a password; applying them at sign-in would
   * lock out anyone whose existing password predates the current policy, and it would tell an
   * attacker which of two guesses had the right shape.
   */
  password: z.string().min(1, 'Enter your password'),
});

export const signupSchema = z
  .object({
    email: emailField,
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, PASSWORD_RULE_HINT)
      .regex(HAS_LETTER, PASSWORD_RULE_HINT)
      .regex(HAS_DIGIT, PASSWORD_RULE_HINT),
    confirmPassword: z.string().min(1, 'Re-enter your password to confirm'),
    /**
     * A field-level refinement rather than `z.literal(true)` or an object-level one, and both
     * alternatives are worse for the same reason. `z.literal(true)` makes the *input* type `true`, so
     * the form could not hold the unchecked state it starts in. An object-level refinement does not run
     * at all while any field is invalid — so a user who submits an empty form would be told about the
     * email and the password now and about the checkbox only on the next attempt.
     */
    acceptedTerms: z.boolean().refine((accepted) => accepted, {
      message: 'Please accept the terms to continue',
    }),
  })
  /**
   * The match check has to be here: it is the one rule that reads two fields. The error is reported on
   * `confirmPassword` rather than at the form level, because that is the field the user should change —
   * an error attached to the form would appear above the button, away from the input that fixes it.
   */
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Both passwords need to match',
    path: ['confirmPassword'],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;

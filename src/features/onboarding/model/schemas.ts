/**
 * Validation for the two onboarding steps the user can type something wrong on.
 *
 * ## Why only two steps have schemas
 *
 * "Who you are" is three `Select`s and "What interests you" is a grid of chips. Neither control can
 * produce a value that is not already in [`options.ts`](./options.ts) — the union *is* the validation —
 * so a schema there would restate the type system at runtime and add a second place for the option list
 * to drift. Those two steps derive "can continue" from the draft directly. A schema earns its place where
 * there is a keyboard.
 *
 * ## Why the free-text rules are forgiving
 *
 * Every pattern below is deliberately looser than the strictest correct one. A regex that rejects a real
 * phone number, a real LinkedIn URL or a real name is not a safeguard — it is a support ticket from
 * somebody who cannot finish signing up, and the person who wanted to enter junk simply enters
 * `9999999999` instead. So the rules catch *mistakes* (an empty field, a phone number with eight digits,
 * a LinkedIn box with an email address pasted into it) and nothing more ambitious than that.
 *
 * Anything that must actually be true — that the phone number reaches this person, that the LinkedIn
 * profile is theirs — is verification, it happens on the server, and it is why the last step exists.
 *
 * ## Why `trim()` is on the strings and not in the components
 *
 * `zodResolver` hands `handleSubmit` the *parsed* output, so trimming here means the draft never holds
 * `"  Priya "` while the field still shows what the user typed. Doing it in an `onChangeText` instead
 * would stop them typing a space between two words.
 */
import { z } from 'zod';

import { CITY_VALUES, ROLE_VALUES, SECTOR_VALUES, STAGE_VALUES } from './options';

/** Ten digits after every separator, bracket and dialling prefix is thrown away. */
const DIGITS = /\D/gu;
const MOBILE_LENGTH = 10;
const MOBILE_MESSAGE = 'Enter a 10-digit mobile number';

/**
 * Scheme optional, one dot required, no whitespace. This is the whole test: people paste
 * `founderstage.com`, `www.founderstage.com` and `https://founderstage.com/team` and all three are the
 * answer to "what is your website".
 */
const URL_PATTERN = /^(?:https?:\/\/)?[^\s.]+\.[^\s]{2,}$/u;

/** Anywhere in the string, so `in/priya` fails and every real shape of a profile URL passes. */
const LINKEDIN_PATTERN = /linkedin\.com\/\S+/iu;

/** A URL on either domain, or a bare `@handle` — the two things people mean by "my Twitter". */
const TWITTER_PATTERN = /^(?:(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/\S+|@?[A-Za-z0-9_]{1,15})$/u;

function isTenDigits(value: string): boolean {
  return value.replace(DIGITS, '').length === MOBILE_LENGTH;
}

/**
 * An optional text field holds `''`, never `undefined` — a `TextInput` has to be controlled from the
 * first render — so "optional" means "empty or valid" rather than `.optional()`.
 */
function optionalText(pattern: RegExp, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === '' || pattern.test(value), message);
}

/* ── Step 1: about you ────────────────────────────────────────────────────────────────────────── */

export const NAME_MAX_LENGTH = 80;

export const aboutYouSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter your full name')
    .max(NAME_MAX_LENGTH, `Keep this under ${String(NAME_MAX_LENGTH)} characters`),
  mobile: z.string().trim().min(1, 'Enter your mobile number').refine(isTenDigits, MOBILE_MESSAGE),
  whatsapp: z
    .string()
    .trim()
    .refine((value) => value === '' || isTenDigits(value), MOBILE_MESSAGE),
  // Required, and `''` rather than `undefined` so the form's shape does not change once it is answered.
  // The message names the control, because an unanswered `Select` shows a placeholder and no red text
  // until the user has been told which one it is.
  city: z.enum(CITY_VALUES, { message: 'Choose the city you are based in' }),
});

export type AboutYouValues = z.infer<typeof aboutYouSchema>;

/* ── Step 2: who you are ──────────────────────────────────────────────────────────────────────── */

/**
 * No form uses this — the step reads the draft directly, as the docblock explains. It exists so the
 * *draft* is typed against the same closed sets, and so the step's "can continue" rule has one
 * definition: [`isRoleStepComplete`](./draft-store.ts).
 */
export const roleSchema = z.object({
  role: z.enum(ROLE_VALUES),
  sector: z.enum(SECTOR_VALUES),
  stage: z.enum(STAGE_VALUES),
});

export type RoleValues = z.infer<typeof roleSchema>;

/* ── Step 4: verification ─────────────────────────────────────────────────────────────────────── */

export const ABOUT_MAX_LENGTH = 280;

export const verificationSchema = z.object({
  website: optionalText(URL_PATTERN, 'Enter a web address, like founderstage.com'),
  // The one required link. It is the cheapest thing a reviewer can check, which is why it is the one
  // the flow insists on rather than asking for a document nobody has to hand.
  linkedin: z
    .string()
    .trim()
    .min(1, 'Add your LinkedIn profile so we can verify you')
    .refine(
      (value) => LINKEDIN_PATTERN.test(value),
      'That does not look like a LinkedIn profile link'
    ),
  twitter: optionalText(TWITTER_PATTERN, 'Enter your handle or profile link'),
  about: z
    .string()
    .trim()
    .min(10, 'A sentence is enough — who you are and what you work on')
    .max(ABOUT_MAX_LENGTH, `Keep this under ${String(ABOUT_MAX_LENGTH)} characters`),
});

export type VerificationValues = z.infer<typeof verificationSchema>;

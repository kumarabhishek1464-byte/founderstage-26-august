/**
 * The slice of a person messaging needs.
 *
 * Not "the profile" — the `profiles` table exists here only as far as messaging requires
 * ([the scoping decision in the plan](../../../../docs/CHAT_ARCHITECTURE.md)), and when a real
 * profiles feature lands this type becomes a projection of its richer one rather than the
 * other way round. Keeping it this narrow is what makes that direction possible.
 *
 * Every field is either needed to render a name, an avatar, or the verified mark. `headline`
 * is here because the people picker is unusable without it: a directory of founders contains
 * more than one "Sam", and the disambiguator is what they do.
 */
import type { UserId } from '@/core/ids';

export interface Profile {
  readonly userId: UserId;
  /**
   * Never empty and never null. The database enforces a non-blank constraint, so no render
   * site needs a `?? 'Unknown'` fallback — and a fallback in even one place would hide the
   * data problem everywhere else.
   */
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly headline: string | null;
  readonly verified: boolean;
}

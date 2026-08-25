/**
 * The onboarding draft — the answers so far, held across four screens.
 *
 * ## Why a store and not route params or one big form
 *
 * Each step is its own route, so each step's component unmounts when the user moves on and every bit of
 * local state with it. The three alternatives are all worse: route params put a phone number in a URL and
 * in the navigation history; one giant form on one screen is the wall of fields this flow exists to avoid;
 * and lifting the state into a shared parent layout means the layout owns four steps' worth of validation.
 * A store is the small answer — the draft lives in exactly one place and every step reads the part it
 * needs.
 *
 * ## Why it is not persisted
 *
 * `zustand/middleware`'s `persist` is right there and it is not used, on purpose. This draft holds a legal
 * name, two phone numbers, a city and a LinkedIn profile — PII, and enough of it to identify somebody —
 * and `AsyncStorage` is unencrypted plaintext on the device. Persisting it would leave that on disk after
 * a user abandoned onboarding, indefinitely, with nothing to clear it. Losing a half-finished draft when
 * the app is killed is the cheaper failure, and the flow is four screens long.
 *
 * `reset()` exists for the same reason, and the last step calls it: once the answers have been submitted,
 * keeping a copy in memory serves nobody.
 *
 * ## Why "can continue" lives here as functions
 *
 * The two select-only steps have no schema ([`schemas.ts`](./schemas.ts) says why), so their completeness
 * rule has to live somewhere. Putting it next to the shape it reads means the rule and the data cannot
 * disagree, and a step component stays a description of a screen rather than a place where a business rule
 * is inlined into a `disabled` prop.
 */
import { create } from 'zustand';

import type { AboutYouValues, VerificationValues } from './schemas';
import type { CityValue, InterestValue, RoleValue, SectorValue, StageValue } from './options';

export interface OnboardingDraft {
  readonly name: string;
  readonly mobile: string;
  readonly whatsapp: string;
  readonly city: CityValue | undefined;

  readonly role: RoleValue | undefined;
  readonly sector: SectorValue | undefined;
  readonly stage: StageValue | undefined;

  readonly interests: readonly InterestValue[];

  readonly website: string;
  readonly linkedin: string;
  readonly twitter: string;
  readonly about: string;
}

/**
 * Text fields start as `''` and selects as `undefined`, and the difference is meaningful: `''` is a field
 * the user has not typed in, `undefined` is a choice nobody has made. A `Select` seeded with the first
 * option would be a silent answer on the user's behalf.
 */
const EMPTY_DRAFT: OnboardingDraft = {
  name: '',
  mobile: '',
  whatsapp: '',
  city: undefined,
  role: undefined,
  sector: undefined,
  stage: undefined,
  interests: [],
  website: '',
  linkedin: '',
  twitter: '',
  about: '',
};

interface OnboardingStore {
  readonly draft: OnboardingDraft;
  readonly setAboutYou: (values: AboutYouValues) => void;
  readonly setRole: (role: RoleValue) => void;
  readonly setSector: (sector: SectorValue) => void;
  readonly setStage: (stage: StageValue) => void;
  readonly toggleInterest: (interest: InterestValue) => void;
  readonly setVerification: (values: VerificationValues) => void;
  readonly reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()((set) => ({
  draft: EMPTY_DRAFT,

  // The two form steps commit a whole validated object at once, because that is what `handleSubmit`
  // hands over and because a half-written step should not survive a back-navigation as partial data.
  setAboutYou: (values) => {
    set((state) => ({ draft: { ...state.draft, ...values } }));
  },
  setVerification: (values) => {
    set((state) => ({ draft: { ...state.draft, ...values } }));
  },

  // The select steps commit per answer, because a `Select` closes on tap and the user expects the choice
  // to be there when they come back to the step.
  setRole: (role) => {
    set((state) => ({ draft: { ...state.draft, role } }));
  },
  setSector: (sector) => {
    set((state) => ({ draft: { ...state.draft, sector } }));
  },
  setStage: (stage) => {
    set((state) => ({ draft: { ...state.draft, stage } }));
  },

  toggleInterest: (interest) => {
    set((state) => {
      const chosen = state.draft.interests;
      const next = chosen.includes(interest)
        ? chosen.filter((value) => value !== interest)
        : [...chosen, interest];

      return { draft: { ...state.draft, interests: next } };
    });
  },

  reset: () => {
    set({ draft: EMPTY_DRAFT });
  },
}));

/**
 * All three answers given. Not "any", because a role without a stage tells the network nothing useful.
 *
 * Takes a `Pick` rather than the whole draft so a component can satisfy it from the three fields it already
 * subscribes to — asking for an `OnboardingDraft` would force the caller to select the entire object and
 * re-render on every unrelated answer.
 */
export function isRoleStepComplete(
  draft: Pick<OnboardingDraft, 'role' | 'sector' | 'stage'>
): boolean {
  return draft.role !== undefined && draft.sector !== undefined && draft.stage !== undefined;
}

/**
 * One interest is enough. The step's whole purpose is to have something to personalise with, and a
 * minimum of three would be the app deciding how curious the user is allowed to be.
 */
export function isInterestsStepComplete(draft: Pick<OnboardingDraft, 'interests'>): boolean {
  return draft.interests.length > 0;
}

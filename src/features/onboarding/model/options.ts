/**
 * The onboarding vocabulary: every list the user picks from, in one file.
 *
 * ## Why values and labels are separate, and why the values are snake_case
 *
 * `SelectOption` splits them for a reason [`Select`](../../../core/design-system/components/Select.tsx)
 * states plainly: the value is a database enum that outlives its wording. `pre_seed` stays put when
 * "Pre-Seed" is restyled to "Pre-seed", and it is already spelled the way a Postgres enum will be, so the
 * migration that introduces the column does not have to translate anything.
 *
 * ## Why each list is a tuple plus a `Record`, not an array of pairs
 *
 * ```ts
 * export const ROLE_VALUES = [...] as const;              // the closed set
 * type RoleValue = (typeof ROLE_VALUES)[number];           // the union, derived
 * const ROLE_LABELS: Readonly<Record<RoleValue, string>>;  // exhaustive by construction
 * ```
 *
 * Adding a role to the tuple widens the union, which makes the `Record` incomplete, which fails the
 * build until it has a label. An array of `{ value, label }` objects cannot do that — a new entry is
 * simply a new entry, and the way it goes wrong is a role that renders as an empty string. This is the
 * same closed-lookup pattern the design system uses for tones and sizes, applied to content.
 *
 * The tuples are also what `z.enum` wants in [`schemas.ts`](./schemas.ts), so the schema and the picker
 * are guaranteed to accept exactly the same set rather than two hand-maintained copies of it.
 *
 * ## "Other" is last in every list
 *
 * A curated network cannot enumerate everyone who belongs in it, and a picker with no escape hatch makes
 * the user either lie or leave. It sorts last because it is the answer for people the earlier ones failed,
 * not a peer of them.
 */
import type { SelectOption } from '@/core/design-system';

/** Builds the `SelectOption` array a `Select` takes from the two halves above it. */
function toOptions<T extends string>(
  values: readonly T[],
  labels: Readonly<Record<T, string>>
): readonly SelectOption<T>[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

/* ── Role ─────────────────────────────────────────────────────────────────────────────────────── */

export const ROLE_VALUES = [
  'founder',
  'co_founder',
  'investor',
  'angel_investor',
  'mentor',
  'advisor',
  'coach',
  'operator',
  'innovator',
  'other',
] as const;

export type RoleValue = (typeof ROLE_VALUES)[number];

const ROLE_LABELS: Readonly<Record<RoleValue, string>> = {
  founder: 'Founder',
  co_founder: 'Co-founder',
  investor: 'Investor',
  angel_investor: 'Angel investor',
  mentor: 'Mentor',
  advisor: 'Advisor',
  coach: 'Coach',
  operator: 'Operator',
  innovator: 'Innovator',
  other: 'Other',
};

export const ROLE_OPTIONS = toOptions(ROLE_VALUES, ROLE_LABELS);

/* ── Sector ───────────────────────────────────────────────────────────────────────────────────── */

export const SECTOR_VALUES = [
  'ai_ml',
  'fintech',
  'healthtech',
  'saas',
  'edtech',
  'ecommerce',
  'deeptech',
  'consumer',
  'climate',
  'other',
] as const;

export type SectorValue = (typeof SECTOR_VALUES)[number];

const SECTOR_LABELS: Readonly<Record<SectorValue, string>> = {
  ai_ml: 'AI / ML',
  fintech: 'FinTech',
  healthtech: 'HealthTech',
  saas: 'SaaS',
  edtech: 'EdTech',
  ecommerce: 'E-commerce',
  deeptech: 'DeepTech',
  consumer: 'Consumer',
  climate: 'Climate tech',
  other: 'Other',
};

export const SECTOR_OPTIONS = toOptions(SECTOR_VALUES, SECTOR_LABELS);

/* ── Stage ────────────────────────────────────────────────────────────────────────────────────── */

export const STAGE_VALUES = [
  'idea',
  'pre_seed',
  'seed',
  'series_a',
  'growth',
  'scale_up',
  'other',
] as const;

export type StageValue = (typeof STAGE_VALUES)[number];

const STAGE_LABELS: Readonly<Record<StageValue, string>> = {
  idea: 'Idea stage',
  pre_seed: 'Pre-seed',
  seed: 'Seed',
  series_a: 'Series A',
  growth: 'Growth stage',
  scale_up: 'Scale-up',
  other: 'Other',
};

export const STAGE_OPTIONS = toOptions(STAGE_VALUES, STAGE_LABELS);

/* ── City ─────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A short list, deliberately. This is not a geocoder — it is the set of places the network currently has
 * enough members in for "founders near you" to mean anything, plus `other` for everyone else. A long
 * alphabetical list of every city would be a worse control (a 200-row sheet with no search) and a claim
 * the product cannot back.
 */
export const CITY_VALUES = [
  'bengaluru',
  'mumbai',
  'delhi_ncr',
  'hyderabad',
  'pune',
  'chennai',
  'kolkata',
  'ahmedabad',
  'jaipur',
  'kochi',
  'other',
] as const;

export type CityValue = (typeof CITY_VALUES)[number];

const CITY_LABELS: Readonly<Record<CityValue, string>> = {
  bengaluru: 'Bengaluru',
  mumbai: 'Mumbai',
  delhi_ncr: 'Delhi NCR',
  hyderabad: 'Hyderabad',
  pune: 'Pune',
  chennai: 'Chennai',
  kolkata: 'Kolkata',
  ahmedabad: 'Ahmedabad',
  jaipur: 'Jaipur',
  kochi: 'Kochi',
  other: 'Other',
};

export const CITY_OPTIONS = toOptions(CITY_VALUES, CITY_LABELS);

/* ── Interests ────────────────────────────────────────────────────────────────────────────────── */

/**
 * The interest catalogue is shaped differently from the lists above because it is chosen differently:
 * many answers, grouped, as chips rather than through a sheet. The union of every interest value is
 * *derived* from this literal — see `InterestValue` below — so the catalogue is still the only place a
 * new interest is written down.
 */
interface InterestCategory {
  readonly id: string;
  readonly title: string;
  readonly options: readonly SelectOption<string>[];
}

export const INTEREST_CATEGORIES = [
  {
    id: 'startup',
    title: 'Startup & entrepreneurship',
    options: [
      { value: 'starting_up', label: 'Starting a startup' },
      { value: 'fundraising', label: 'Fundraising' },
      { value: 'product', label: 'Product development' },
      { value: 'go_to_market', label: 'Go-to-market' },
      { value: 'hiring', label: 'Hiring & team building' },
      { value: 'exits', label: 'Exits & M&A' },
    ],
  },
  {
    id: 'investing',
    title: 'Investing',
    options: [
      { value: 'angel_investing', label: 'Angel investing' },
      { value: 'venture_capital', label: 'Venture capital' },
      { value: 'private_equity', label: 'Private equity' },
      { value: 'syndicates', label: 'Syndicates' },
      { value: 'due_diligence', label: 'Due diligence' },
      { value: 'portfolio_support', label: 'Portfolio support' },
    ],
  },
  {
    id: 'learning',
    title: 'Learning & growth',
    options: [
      { value: 'strategy', label: 'Business strategy' },
      { value: 'leadership', label: 'Leadership' },
      { value: 'marketing', label: 'Marketing & growth' },
      { value: 'sales', label: 'Sales' },
      { value: 'operations', label: 'Operations' },
      { value: 'productivity', label: 'Personal productivity' },
    ],
  },
  {
    id: 'network',
    title: 'Network & community',
    options: [
      { value: 'networking', label: 'Networking' },
      { value: 'mentorship', label: 'Mentorship' },
      { value: 'cofounder_matching', label: 'Co-founder matching' },
      { value: 'events', label: 'Events & meetups' },
      { value: 'advisory', label: 'Advisory roles' },
      { value: 'peer_groups', label: 'Peer groups' },
    ],
  },
  {
    id: 'technology',
    title: 'Technology & innovation',
    options: [
      { value: 'ai', label: 'AI & machine learning' },
      { value: 'saas_tech', label: 'SaaS' },
      { value: 'web3', label: 'Web3 & blockchain' },
      { value: 'robotics', label: 'Robotics' },
      { value: 'space', label: 'Space & defence' },
      { value: 'devtools', label: 'Developer tools' },
    ],
  },
  {
    id: 'impact',
    title: 'Impact & sustainability',
    options: [
      { value: 'climate_tech', label: 'Climate tech' },
      { value: 'social_impact', label: 'Social impact' },
      { value: 'sustainability', label: 'Sustainability' },
      { value: 'healthcare_access', label: 'Healthcare access' },
      { value: 'education_access', label: 'Education access' },
      { value: 'financial_inclusion', label: 'Financial inclusion' },
    ],
  },
] as const satisfies readonly InterestCategory[];

/** Every interest value in the catalogue, as one union. Derived, so it cannot fall out of date. */
export type InterestValue = (typeof INTEREST_CATEGORIES)[number]['options'][number]['value'];

/**
 * How many chips each category shows before "See more". Three: enough to make the category legible
 * without turning the screen into thirty-six chips the user has to read past to reach the button.
 */
export const INTEREST_PREVIEW_COUNT = 3;

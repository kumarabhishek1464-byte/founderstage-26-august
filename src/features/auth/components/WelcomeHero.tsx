/**
 * `WelcomeHero` — three lanes of pills drifting slowly in alternating directions, behind the headline.
 *
 * ## Why pills and not faces
 *
 * The reference screen is a collage of member photographs. This app has no member photographs —
 * `assets/` holds an icon and a splash — and inventing a cast of stock founders would put fabricated
 * people on the first screen a real one ever sees. So the hero shows what the network is *made of*
 * rather than who is in it: the roles, the sectors, the stages. That is a true statement about the
 * product on day one, and it is still the thing the headline is claiming.
 *
 * ## Why some pills are black
 *
 * A field of white-on-white pills is clean and slightly inert. The design language's answer to "add
 * emphasis" is not colour — red is reserved and there is no second hue — so the emphasis is
 * **luminance**: a handful of pills render filled (`Chip selected`), and the inversion gives the lane
 * depth and rhythm without introducing a single new value. It is the same reasoning `Chip` uses for
 * selection, applied for a visual rather than a stateful reason.
 *
 * Two pills carry the accent dot. Two, out of nineteen — enough to tie the hero to the red button below
 * it, few enough that red still reads as a signal. A dot on every role pill (which is what the reference
 * does) turns the accent into decoration, and then the CTA has nothing left to borrow.
 *
 * ## Why it is not interactive
 *
 * Nothing here is tappable. A moving target is a target you miss, and a pill that navigated somewhere
 * would be a control that changes position under the finger — so the chips are constructed without
 * `onPress`, which makes `Chip` render a plain view with no role and nothing for a screen reader to
 * offer as an action. The lanes read as one decorative band; the headline underneath is what carries the
 * meaning, and `Marquee` hides the duplicate copies so the band is announced once at most.
 *
 * Reduced motion is handled inside `Marquee`: the lanes stop, and the pills stay.
 */
import { Chip, createStyles, Marquee, Stack } from '@/core/design-system';

import type { ChipSize } from '@/core/design-system';

interface HeroPill {
  readonly label: string;
  /** Renders filled (`surface.inverse`). Purely visual — see the note on luminance above. */
  readonly filled?: boolean;
  /** The accent mark. Used twice in the whole hero, on purpose. */
  readonly dot?: boolean;
}

interface HeroLane {
  readonly id: string;
  readonly pills: readonly HeroPill[];
  readonly size: ChipSize;
  readonly direction: 'left' | 'right';
  /**
   * Points per second. The three lanes differ slightly so they never lock into a single moving block —
   * matched speeds read as one sheet sliding, which is the effect this is trying to avoid.
   */
  readonly speed: number;
}

/**
 * Roles, then sectors, then the ways people show up. The middle lane is `sm` and runs the other way,
 * which is what stops three rows of the same pill reading as a table.
 */
const LANES: readonly HeroLane[] = [
  {
    id: 'roles',
    size: 'md',
    direction: 'left',
    speed: 22,
    pills: [
      { label: 'Founder', filled: true },
      { label: 'Angel Investor' },
      { label: 'Co-founder', dot: true },
      { label: 'Venture Capital' },
      { label: 'Mentor' },
      { label: 'Operator', filled: true },
      { label: 'Advisor' },
    ],
  },
  {
    id: 'sectors',
    size: 'sm',
    direction: 'right',
    speed: 16,
    pills: [
      { label: 'AI / ML' },
      { label: 'FinTech', filled: true },
      { label: 'HealthTech' },
      { label: 'SaaS' },
      { label: 'DeepTech' },
      { label: 'Climate Tech', filled: true },
      { label: 'Consumer' },
      { label: 'EdTech' },
    ],
  },
  {
    id: 'ways-in',
    size: 'md',
    direction: 'left',
    speed: 19,
    pills: [
      { label: 'Coach' },
      { label: 'Innovator', filled: true },
      { label: 'Scout', dot: true },
      { label: 'Syndicate' },
      { label: 'Studio' },
      { label: 'Seed' },
    ],
  },
];

const useStyles = createStyles((t) => ({
  /**
   * The trailing space is `paddingRight` on the lane rather than a `gap` on the marquee, because the
   * seam between one copy of the lane and the next is where a missing gap shows: without it, the last
   * pill and the first pill touch once per cycle and the loop becomes visible.
   */
  lane: { paddingRight: t.spacing.sm },
}));

export function WelcomeHero() {
  const styles = useStyles();

  return (
    <Stack gap="sm">
      {LANES.map((lane) => (
        <Marquee key={lane.id} direction={lane.direction} speed={lane.speed}>
          <Stack direction="row" align="center" gap="sm" style={styles.lane}>
            {lane.pills.map((pill) => (
              <Chip
                key={pill.label}
                label={pill.label}
                size={lane.size}
                selected={pill.filled}
                dot={pill.dot}
              />
            ))}
          </Stack>
        </Marquee>
      ))}
    </Stack>
  );
}

/**
 * `Icon` — the single iconography seam. One family (Lucide), three token sizes, the shared tone
 * vocabulary, and a **closed registry** of names.
 *
 * ## Why a registry rather than an `icon={ChevronRight}` prop
 *
 * The obvious API takes the Lucide component as a prop and lets the caller import it. It has two
 * problems, and the second is the decisive one.
 *
 * First, it puts `lucide-react-native` in every feature's import list, so the "one icon family"
 * constraint becomes a convention nobody can enforce — a second library arrives the first time
 * someone cannot find an icon.
 *
 * Second, **Metro does not tree-shake by default.** `import { ChevronRight } from
 * 'lucide-react-native'` pulls the package's barrel, and the barrel re-exports every one of Lucide's
 * ~1,600 icons — all of which then ship, whether or not a single one is rendered. The registry below
 * imports each icon from its own subpath (`lucide-react-native/icons/chevron-right`), so the bundle
 * contains exactly what is registered and nothing else. That is not a micro-optimisation; it is the
 * difference between a handful of path definitions and the whole set.
 *
 * ## The registry is meant to be short
 *
 * It is seeded with the icons a UI cannot do without. Adding one is two lines — an import and a
 * registry entry — and that small friction is deliberate: it is the review point where "we already
 * have `x`, use that" gets said. See [Rule 1](../../../../CLAUDE.md).
 *
 * ## Decorative by default
 *
 * An icon beside a label is decoration, and announcing it duplicates the label. So `Icon` is hidden
 * from assistive tech unless given an `accessibilityLabel`, at which point it becomes an `image` with
 * that name. The default is the safe one: a redundant announcement is a worse bug than a missing one
 * here, because the label beside it already carries the meaning.
 */
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import AtSign from 'lucide-react-native/icons/at-sign';
import Bell from 'lucide-react-native/icons/bell';
import Bookmark from 'lucide-react-native/icons/bookmark';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Building2 from 'lucide-react-native/icons/building-2';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import Clock from 'lucide-react-native/icons/clock';
import CircleDollarSign from 'lucide-react-native/icons/circle-dollar-sign';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Globe from 'lucide-react-native/icons/globe';
import House from 'lucide-react-native/icons/house';
import Info from 'lucide-react-native/icons/info';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import Link from 'lucide-react-native/icons/link';
import Lock from 'lucide-react-native/icons/lock';
import Mail from 'lucide-react-native/icons/mail';
import MapPin from 'lucide-react-native/icons/map-pin';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import EllipsisVertical from 'lucide-react-native/icons/ellipsis-vertical';
import Phone from 'lucide-react-native/icons/phone';
import Rocket from 'lucide-react-native/icons/rocket';
import SquarePen from 'lucide-react-native/icons/square-pen';
import Plus from 'lucide-react-native/icons/plus';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import Share2 from 'lucide-react-native/icons/share-2';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import Sparkles from 'lucide-react-native/icons/sparkles';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Upload from 'lucide-react-native/icons/upload';
import User from 'lucide-react-native/icons/user';
import Users from 'lucide-react-native/icons/users';
import X from 'lucide-react-native/icons/x';

import { hiddenFromAssistiveTech } from '../a11y';
import { useTheme } from '../theme';
import { toneColor } from './tone';

import type { StyleProp, ViewStyle } from 'react-native';
import type { Theme } from '../theme';
import type { Tone } from './tone';

/**
 * Derived from a real import rather than written out as `ComponentType<LucideProps>`. Every Lucide
 * icon has the identical type, and deriving it means a Lucide major that changes the component shape
 * fails here — at one line — instead of at every entry in the registry.
 */
type IconComponent = typeof X;

/**
 * Names are semantic where the app has an opinion (`'close'`, not `'x'`) and literal where it does
 * not (`'chevronRight'` is a direction, not a meaning). The rename matters: `'close'` survives a
 * decision to use a different glyph for dismissal, `'x'` does not.
 */
const REGISTRY = {
  // Navigation and disclosure
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  back: ArrowLeft,
  forward: ArrowRight,
  close: X,

  // Status. Paired with the matching `tone`, never relied on alone — colour and glyph together,
  // because colour alone fails for the ~8% of men with a colour vision deficiency.
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
  check: Check,
  /** A guarantee rather than an outcome: "your details are encrypted", "we review this". */
  verified: ShieldCheck,

  // Actions and destinations
  add: Plus,
  search: Search,
  refresh: RefreshCw,
  upload: Upload,
  notifications: Bell,
  settings: Settings,
  profile: User,
  home: House,
  chat: MessageCircle,

  // Feed engagement
  thumbsUp: ThumbsUp,
  share: Share2,
  bookmark: Bookmark,
  moreHorizontal: Ellipsis,
  /**
   * The overflow affordance on a *row*, where the horizontal form would read as belonging to the text
   * beside it rather than to the row it terminates. Both exist because the axis is a layout decision,
   * not a synonym.
   */
  moreVertical: EllipsisVertical,
  sparkles: Sparkles,

  /**
   * The three things a founder can start from the composer. Named after the artefact produced rather
   * than the drawing: the glyph for `poll` is a bar chart, and a registry entry called `barChart` would
   * get reused for analytics and then diverge from what the composer needs.
   */
  compose: SquarePen,
  question: CircleQuestionMark,
  poll: ChartColumn,
  /** Community and launch surfaces — the discovery carousel's group card. */
  rocket: Rocket,

  /**
   * A password field's two states. Named for what the control *does* rather than for the eye, because
   * the glyph and the action are inverted: the crossed-out eye means "hidden", and the control
   * carrying it *reveals*. `reveal`/`conceal` is the pair a call site can get right without stopping
   * to think about which drawing means which.
   */
  reveal: Eye,
  conceal: EyeOff,

  /**
   * Glyphs that name what a field holds. A leading icon in a text field is a scanning aid — it lets a
   * form read as a shape before it reads as words — so these are named after the content, which is
   * the thing a form author knows.
   */
  email: Mail,
  password: Lock,
  phone: Phone,
  location: MapPin,
  website: Globe,
  link: Link,
  atSign: AtSign,
  role: Briefcase,
  organization: Building2,
  growth: TrendingUp,
  time: Clock,

  /**
   * Glyphs the app maps to its own destinations, named after the drawing rather than the
   * destination — `coins`, not `capital`.
   *
   * The rule at the top of this block ("semantic where the app has an opinion") still holds; the
   * opinion just does not belong here. `home`, `chat` and `search` are universal interface
   * vocabulary, so a semantic name is safe. "Capital" and "Hire" are FounderStage's information
   * architecture, and a design-system primitive that knows them is the `FounderCard` the barrel
   * rules out. `core/navigation/destinations.ts` holds the mapping, so swapping `coins` for
   * `landmark` is one line there and nothing here changes meaning.
   */
  circleDollarSign: CircleDollarSign,
  layoutGrid: LayoutGrid,
  users: Users,
  shoppingBag: ShoppingBag,
} as const satisfies Record<string, IconComponent>;

export type IconName = keyof typeof REGISTRY;

/**
 * Matched to the type an icon sits beside, so the two share a baseline — `sm` with
 * `caption`/`footnote`, `md` with `body`/`label`, `lg` with `title3` and up.
 */
export type IconSize = 'sm' | 'md' | 'lg';

interface IconProps {
  readonly name: IconName;
  readonly size?: IconSize;
  /** Defaults to `secondary` — an icon beside text should sit *under* it in weight, not level with it. */
  readonly tone?: Tone;
  /**
   * Supplying this makes the icon meaningful to assistive tech. Omit it whenever a visible label sits
   * beside the icon; supply it when the icon is the only thing carrying the meaning.
   */
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** Reads the icon-square tokens off the theme rather than repeating 16/20/24. */
const SIZE_TOKEN: Readonly<Record<IconSize, (t: Theme) => number>> = {
  sm: (t) => t.size.iconSm,
  md: (t) => t.size.iconMd,
  lg: (t) => t.size.iconLg,
};

/**
 * The stroke weight for every icon in the app. Lucide ships at 2.0; 1.5 is the "Apple line-icon"
 * register — noticeably lighter, and what makes the icon set read as considered rather than default.
 * One number, one place, so a family-wide retune is a single edit.
 */
const STROKE_WIDTH = 1.5;

export function Icon({
  name,
  size = 'md',
  tone = 'secondary',
  accessibilityLabel,
  style,
}: IconProps) {
  const theme = useTheme();
  const Glyph = REGISTRY[name];
  const isDecorative = accessibilityLabel === undefined;

  return (
    <Glyph
      width={SIZE_TOKEN[size](theme)}
      height={SIZE_TOKEN[size](theme)}
      // Lucide sets `stroke` from `color`; `strokeWidth` is authored globally in this component so
      // every icon speaks with the same voice — see the constant above.
      color={toneColor(theme, tone)}
      strokeWidth={STROKE_WIDTH}
      style={style}
      // `accessible` is what makes the SVG a single accessibility element. Lucide's glyphs are two or
      // three `<Path>`/`<Circle>` children, and react-native-svg copies `accessibilityLabel` onto all
      // of them; on iOS, only the `accessible` flag on the parent collapses that subtree into one
      // announcement rather than several. Setting the role and the label without it leaves the icon
      // outside the accessibility tree entirely on both platforms.
      accessible={isDecorative ? undefined : true}
      accessibilityRole={isDecorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      // `react-native-svg` renders a real `<svg>` on the web and forwards whatever it does not
      // recognise straight to the DOM, so the two native props arrive at React DOM as unknown
      // attributes and are logged as errors on every render. `../a11y` owns that platform split, and
      // on the web it spells the same intent as `aria-hidden` — which an `<svg>` does understand.
      {...hiddenFromAssistiveTech(isDecorative)}
    />
  );
}

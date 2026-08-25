/**
 * Static mock data that powers the home feed while the app is a shell.
 *
 * Every value here is a design artefact, not production data. The shapes are the API contracts the
 * feed screens will eventually expect from a real backend, and keeping them typed here is what stops
 * the first integration from inventing new fields.
 */
import type { Tone } from '@/core/design-system';

// ---------------------------------------------------------------------------
// Feed tabs
// ---------------------------------------------------------------------------

export const FEED_TABS = [
  'For You',
  'Following',
  'Discover',
  'Mentors',
  'Investors',
  'Startups',
] as const;

export type FeedTab = (typeof FEED_TABS)[number];

// ---------------------------------------------------------------------------
// Post
// ---------------------------------------------------------------------------

/**
 * How an author is standing in the network is shown, not described: `Founder` in the brand red,
 * `Mentor` in the secondary violet, `Investor` in blue. The tone is data rather than a `switch` in the
 * card, because the badge set is a product decision that will grow (`Operator`, `Angel`, `Scout`) and
 * a component-local mapping is the thing that silently falls back to red when it does.
 */
export interface PostRole {
  readonly label: string;
  readonly tone: Tone;
}

export interface PostAuthor {
  readonly name: string;
  /** Role and company as one phrase — "CEO at BuildIt". One string because it reads as one. */
  readonly headline: string;
  readonly role: PostRole;
  /** `true` when the author is currently online. Renders a green dot over the avatar. */
  readonly online: boolean;
}

/**
 * The thumbnail on the right of a post.
 *
 * `kind` distinguishes the two treatments the design uses, which are not interchangeable: `insight` is
 * a dark editorial panel the app generated (a chart, a breakdown) and carries a violet accent line;
 * `preview` is somebody else's page, so it gets a light chrome with a title bar and reads as a
 * quotation rather than as content.
 */
export type PostMediaKind = 'insight' | 'preview';

export interface PostMedia {
  readonly kind: PostMediaKind;
  /** Small line above the headline — the source, or the subject. */
  readonly eyebrow?: string;
  readonly headline: string;
  /** The emphasised second line. `insight` only. */
  readonly accentLine?: string;
  /** Body lines for a `preview`, rendered small and quiet under the headline. */
  readonly lines?: readonly string[];
  /** Pill labels along the bottom of a `preview`, mirroring the page's own buttons. */
  readonly actions?: readonly string[];
}

export interface PostStats {
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
}

export interface PostLikedBy {
  /**
   * The people named in the sentence — "Rahul, Karan and 124 others". Two at most; the row is one
   * line and a third name pushes the count off the end.
   */
  readonly names: readonly string[];
  /**
   * The faces shown, which is deliberately a different list from `names`: the strip fits three avatars
   * and only two names, so the third face is a liker the sentence does not have room to credit.
   */
  readonly faces: readonly string[];
  readonly totalOthers: number;
}

export interface FeedPost {
  readonly id: string;
  readonly author: PostAuthor;
  readonly timeAgo: string;
  readonly visibility: string;
  /** A bold lead line. Present when the post is an article rather than a remark. */
  readonly title?: string;
  /** Paragraphs. An array rather than one string with `\n`, so the gap between them is a token. */
  readonly body: readonly string[];
  readonly hashtags: readonly string[];
  readonly media?: PostMedia;
  readonly stats: PostStats;
  readonly likedBy?: PostLikedBy;
}

export const FEED_POSTS: readonly FeedPost[] = [
  {
    id: 'post-1',
    author: {
      name: 'Ananya Verma',
      headline: 'CEO at BuildIt',
      role: { label: 'Founder', tone: 'accent' },
      online: true,
    },
    timeAgo: '2h ago',
    visibility: 'Public',
    body: [
      'Just closed our pre-seed round! 🎉',
      'What were the biggest challenges you faced while raising your first round?',
    ],
    hashtags: ['#funding', '#startups', '#raisingcapital'],
    stats: { likes: 126, comments: 48, shares: 12 },
    likedBy: {
      names: ['Rahul', 'Karan'],
      faces: ['Rahul Sharma', 'Karan Mehta', 'Priya Iyer'],
      totalOthers: 124,
    },
  },
  {
    id: 'post-2',
    author: {
      name: 'Vikram Singh',
      headline: 'Growth Lead at ScaleUp',
      role: { label: 'Mentor', tone: 'violet' },
      online: true,
    },
    timeAgo: '5h ago',
    visibility: 'Public',
    title: 'Explaining Unit Economics Simply',
    body: ['A quick breakdown of how we think about unit economics at ScaleUp.'],
    hashtags: [],
    media: {
      kind: 'insight',
      eyebrow: 'Understanding',
      headline: 'Unit Economics',
      accentLine: 'Unit Economics',
    },
    stats: { likes: 89, comments: 27, shares: 8 },
  },
  {
    id: 'post-3',
    author: {
      name: 'Karan Malhotra',
      headline: 'Co-founder at TechNova',
      role: { label: 'Founder', tone: 'accent' },
      online: true,
    },
    timeAgo: '1d ago',
    visibility: 'Public',
    body: [
      'Looking for feedback on our MVP landing page.',
      "What's working / not working for you?",
    ],
    hashtags: [],
    media: {
      kind: 'preview',
      eyebrow: 'TechNova',
      headline: 'Built for\nFounders.\nBy Founders.',
      lines: ['TechNova helps early stage startups', 'build, launch and grow faster.'],
      actions: ['Get Early Access', 'Learn More'],
    },
    stats: { likes: 54, comments: 18, shares: 5 },
  },
];

// ---------------------------------------------------------------------------
// Discovery cards
// ---------------------------------------------------------------------------

/**
 * Two card shapes, because the two things being offered are not the same: a `group` is one place with
 * a membership count, so it leads with a mark; `people` is a set of humans, so it leads with their
 * faces. Rendering both from one template is what produced a group card with an empty avatar row.
 */
export type DiscoveryKind = 'group' | 'people';

export interface DiscoveryCard {
  readonly id: string;
  readonly kind: DiscoveryKind;
  readonly title: string;
  readonly subtitle: string;
  readonly actionLabel: string;
  /** Initials standing in for avatar URIs. `people` only. */
  readonly faces: readonly string[];
  /** The "+N" after the faces. 0 hides it. */
  readonly extraCount: number;
}

export const DISCOVERY_CARDS: readonly DiscoveryCard[] = [
  {
    id: 'disc-1',
    kind: 'group',
    title: 'Founders Hub 🚀',
    subtitle: '128 members • 12 online',
    actionLabel: 'Join',
    faces: [],
    extraCount: 0,
  },
  {
    id: 'disc-2',
    kind: 'people',
    title: 'Top Mentors for You',
    subtitle: 'Based on your goals',
    actionLabel: 'Connect',
    faces: ['Rahul Kapoor', 'Aditi Sharma', 'Priya Menon'],
    extraCount: 8,
  },
  {
    id: 'disc-3',
    kind: 'people',
    title: 'Active Investors',
    subtitle: 'Investing in your sector',
    actionLabel: 'View',
    faces: ['Arjun Jain', 'Neha Kulkarni', 'Sanjay Rao'],
    extraCount: 6,
  },
  {
    id: 'disc-4',
    kind: 'people',
    title: 'Startups like Yours',
    subtitle: 'Early stage • SaaS',
    actionLabel: 'Explore',
    faces: ['Tara Nair', 'Bhavna Fernandes', 'Manish Gupta'],
    extraCount: 10,
  },
];

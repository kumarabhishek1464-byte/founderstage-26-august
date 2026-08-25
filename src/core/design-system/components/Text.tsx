/**
 * `Text` — the only text primitive. React Native's own `Text` is banned in features
 * (`eslint.config.js`), so every string on screen goes through here and therefore through a named
 * typographic role and a named tone. That is the whole point: type is the hierarchy in this design
 * language, and a screen must not be able to invent a size.
 *
 * Two axes, deliberately independent:
 *
 * - **`variant`** picks the role — size, weight, line height, tracking — from `typography`.
 * - **`tone`** picks the colour from the theme, and nothing else.
 *
 * They are orthogonal because they are retuned for different reasons: `title2` is a rank, `accent`
 * is a meaning, and coupling them (a heading that is always near-black) would make "a red section
 * title" require fighting the component. The cost is that a title carries `tone="heading"`
 * explicitly; the benefit is that the two never have to be untangled later.
 *
 * `style` is a token-only escape hatch. It exists for layout a role cannot express —
 * `marginBottom: theme.spacing.md`, a `flex: 1` in a row — and it is safe as an escape hatch
 * because `no-restricted-syntax` bans raw hex and raw spacing numbers at every feature call site, so
 * the only values that can reach it are theme tokens. It is intentionally last in the cascade so a
 * caller can override, and intentionally not the way colour or size is set.
 */
import { Text as RNText } from 'react-native';

import { createStyles } from '../theme';
import { toneColor } from './tone';

import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import type { TypographyRole } from '../tokens';
import type { Tone } from './tone';

export type TextAlign = 'auto' | 'left' | 'center' | 'right';

/**
 * Heading roles and their outline rank. A map rather than a `Set` of "is this a heading", because the
 * rank is load-bearing on web: `react-native-web` reads `aria-level` in
 * `propsToAccessibilityComponent` and, **with no level, renders every `role="header"` as `<h1>`**. A
 * screen with one `title1` and three `title3`s would emit four `<h1>`s — a document with four top-level
 * headings, which is worse for a screen-reader user navigating by heading than no headings at all. The
 * rank makes it `h1`, `h3`, `h3`, `h3`.
 *
 * `display` and `title1` are both rank 1 by design: they are alternative treatments of "the one thing
 * this screen is about" — a hero versus a screen title — and a screen uses one or the other, never
 * both. If a layout ever needs both, the second one is the wrong role, not a missing rank.
 *
 * Native ignores the level on iOS and honours it on recent Android; the value is correct either way,
 * so there is no platform branch.
 */
const HEADING_LEVEL: Readonly<Partial<Record<TypographyRole, number>>> = {
  display: 1,
  title1: 1,
  title2: 2,
  title3: 3,
  headline: 4,
};

interface TextProps {
  readonly children: ReactNode;
  /** Typographic role. Defaults to `body` — running prose is the common case. */
  readonly variant?: TypographyRole;
  /** Foreground colour by meaning. Defaults to `body`. */
  readonly tone?: Tone;
  readonly align?: TextAlign;
  /**
   * Caps the run and adds an ellipsis. Named through to RN unchanged; here so a caller does not
   * reach past this component to the primitive for the one common layout need `variant` cannot
   * cover.
   */
  readonly numberOfLines?: number;
  /**
   * Overrides the accessible label. Rarely needed — `overline` sets it automatically (see below).
   * Exposed for the case where the visible text is not the right thing to announce (`"1.2k"` read
   * as `"1200"`).
   */
  readonly accessibilityLabel?: string;
  /** Token-only layout escape hatch. Last in the cascade, so it overrides. */
  readonly style?: StyleProp<TextStyle>;
}

/**
 * One stylesheet entry per role and one per tone, built once per theme by `createStyles` and then
 * composed by reference. This is a typed lookup, not string parsing: `styles[variant]` indexes a
 * sheet whose keys are exactly `TypographyRole`, so a variant that is not a real role does not
 * type-check — [ADR-0005](../../../../docs/adr/0005-styling-approach.md) requires the map rather
 * than a constructed `` `tone${Capitalize<…>}` `` key.
 *
 * The tone entries read their values from `toneColor`, so this sheet interns the colours without
 * redefining them. `overline` uppercases here rather than in the token, because `textTransform` is a
 * rendering concern and the token stays the sentence-case truth — which is what lets the accessible
 * label below be correct.
 */
const useStyles = createStyles((t) => ({
  display: t.typography.display,
  title1: t.typography.title1,
  title2: t.typography.title2,
  title3: t.typography.title3,
  headline: t.typography.headline,
  body: t.typography.body,
  bodyStrong: t.typography.bodyStrong,
  subhead: t.typography.subhead,
  footnote: t.typography.footnote,
  caption: t.typography.caption,
  overline: { ...t.typography.overline, textTransform: 'uppercase' },
  label: t.typography.label,

  tonePrimary: { color: toneColor(t, 'primary') },
  toneHeading: { color: toneColor(t, 'heading') },
  toneBody: { color: toneColor(t, 'body') },
  toneSecondary: { color: toneColor(t, 'secondary') },
  toneTertiary: { color: toneColor(t, 'tertiary') },
  toneDisabled: { color: toneColor(t, 'disabled') },
  toneInverse: { color: toneColor(t, 'inverse') },
  toneAccent: { color: toneColor(t, 'accent') },
  toneLink: { color: toneColor(t, 'link') },
  toneViolet: { color: toneColor(t, 'violet') },
  toneSuccess: { color: toneColor(t, 'success') },
  toneWarning: { color: toneColor(t, 'warning') },
  toneError: { color: toneColor(t, 'error') },
  toneInfo: { color: toneColor(t, 'info') },

  alignAuto: { textAlign: 'auto' },
  alignLeft: { textAlign: 'left' },
  alignCenter: { textAlign: 'center' },
  alignRight: { textAlign: 'right' },
}));

type SheetKey = keyof ReturnType<typeof useStyles>;

/** Tone name → sheet key. Typed so a missing tone is a compile error, not a blank colour. */
const TONE_STYLE: Readonly<Record<Tone, SheetKey>> = {
  primary: 'tonePrimary',
  heading: 'toneHeading',
  body: 'toneBody',
  secondary: 'toneSecondary',
  tertiary: 'toneTertiary',
  disabled: 'toneDisabled',
  inverse: 'toneInverse',
  accent: 'toneAccent',
  link: 'toneLink',
  violet: 'toneViolet',
  success: 'toneSuccess',
  warning: 'toneWarning',
  error: 'toneError',
  info: 'toneInfo',
};

/**
 * Alignment through the sheet too, rather than an inline `{ textAlign: align }`. An inline object is
 * a new identity on every render, which defeats `React.memo` on any row containing centred text —
 * the exact case a list has hundreds of.
 */
const ALIGN_STYLE: Readonly<Record<TextAlign, SheetKey>> = {
  auto: 'alignAuto',
  left: 'alignLeft',
  center: 'alignCenter',
  right: 'alignRight',
};

export function Text({
  children,
  variant = 'body',
  tone = 'body',
  align,
  numberOfLines,
  accessibilityLabel,
  style,
}: TextProps) {
  const styles = useStyles();

  // `overline` renders uppercase via `textTransform`, which transforms the *rendered* string — a
  // screen reader would then spell out "N-E-W" instead of reading "New". Passing the original text
  // as the label keeps the announcement sentence-case. Only done when children is a plain string;
  // for rich children there is nothing to preserve and the caller owns the label.
  const resolvedLabel =
    accessibilityLabel ??
    (variant === 'overline' && typeof children === 'string' ? children : undefined);

  const headingLevel = HEADING_LEVEL[variant];

  return (
    <RNText
      style={[
        styles[variant],
        styles[TONE_STYLE[tone]],
        align !== undefined && styles[ALIGN_STYLE[align]],
        style,
      ]}
      numberOfLines={numberOfLines}
      // Headings are announced as headings, so assistive-tech users can navigate by them.
      accessibilityRole={headingLevel !== undefined ? 'header' : undefined}
      // Paired with the role, never alone: `aria-level` on a non-heading is meaningless to every
      // platform that reads it, and on web it would still not produce a heading element.
      aria-level={headingLevel}
      accessibilityLabel={resolvedLabel}
    >
      {children}
    </RNText>
  );
}

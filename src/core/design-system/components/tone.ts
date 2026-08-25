/**
 * The foreground vocabulary shared by every component that paints text or an icon: `Text`, `Icon`,
 * `Spinner`, and the label inside `Button`.
 *
 * It lives in its own module because the mapping from a *meaning* (`'error'`) to a *value*
 * (`status.error`) must have one definition. Three components each carrying their own twelve-entry
 * map is three chances for `tertiary` to mean `#8A8A8A` in two of them and `#666666` in the third,
 * and that kind of drift is invisible in review.
 *
 * Note that `Text` still declares twelve stylesheet entries rather than calling {@link toneColor} at
 * render time. Those entries are *interning*, not a second source of truth — each one reads its value
 * from here, and having them in a sheet is what gives a memoised list row a stable style identity
 * ([ADR-0005](../../../../docs/adr/0005-styling-approach.md)).
 */
import type { Theme } from '../theme';

/**
 * Every colour a foreground element can legitimately take: the eight `text.*` roles plus the four
 * `status.*` meanings.
 *
 * `surface`, `border`, `action` and `focus` are deliberately absent. Text is never painted a border
 * colour, and an `action.primary` label on an `action.primary` fill is invisible — offering them
 * would only make those mistakes expressible.
 *
 * Flat rather than mirroring the palette's `text.*` / `status.*` grouping, because a call site wants
 * `tone="error"`, not `tone="status.error"`. The grouping is an implementation detail of the palette.
 */
export type Tone =
  /** Display type and single strong titles. Pure black. */
  | 'primary'
  /** Headings in a dense stack, where pure black reads heavy line after line. */
  | 'heading'
  /** Running prose. The default nearly everywhere. */
  | 'body'
  | 'secondary'
  /** Timestamps, counts, metadata. AA-large only — never body copy. */
  | 'tertiary'
  | 'disabled'
  /** On `action.primary` or `surface.inverse`. */
  | 'inverse'
  /** Red as a foreground. Emphasis and large type only. */
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

/**
 * A resolver per tone rather than a colour per tone: the values only exist on a theme, which only
 * exists at render. Still a typed lookup, so a tone added to the union without an entry here is a
 * compile error rather than a transparent foreground.
 */
const TONE_COLOR: Readonly<Record<Tone, (t: Theme) => string>> = {
  primary: (t) => t.colors.text.primary,
  heading: (t) => t.colors.text.heading,
  body: (t) => t.colors.text.body,
  secondary: (t) => t.colors.text.secondary,
  tertiary: (t) => t.colors.text.tertiary,
  disabled: (t) => t.colors.text.disabled,
  inverse: (t) => t.colors.text.inverse,
  accent: (t) => t.colors.text.accent,
  success: (t) => t.colors.status.success,
  warning: (t) => t.colors.status.warning,
  error: (t) => t.colors.status.error,
  info: (t) => t.colors.status.info,
};

/** Resolve a tone against a theme. The only way a component learns a foreground colour. */
export function toneColor(theme: Theme, tone: Tone): string {
  return TONE_COLOR[tone](theme);
}

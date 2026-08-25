/**
 * The component barrel. Features import from `@/core/design-system`; this file is what that
 * resolves to for components.
 *
 * Every entry is a *primitive* — a thing with no product meaning. There is no `FounderCard` and no
 * `FundingBadge` here, and there never should be: a component that knows what a founder is belongs to
 * the feature that owns founders. The line is what keeps this tree importable from anywhere without
 * dragging a domain along ([ADR-0003](../../../../docs/adr/0003-single-core-tree.md)).
 *
 * `Wordmark` is the one entry that names the product, and it is the exception the rule intends. The line
 * being drawn is against **domain** concepts — founders, rounds, listings — because those belong to a
 * feature. A brand mark is not a domain concept; it is the visual identity, and the visual identity is
 * precisely what a design system is for. If it lived in the app shell instead, the second surface that
 * needs it (a splash screen, an auth screen, a signed-out state) would either import from the shell or
 * draw it again.
 *
 * `tone.ts` exports `toneColor` as well as the `Tone` type, but only the type is re-exported. Callers
 * pass `tone="secondary"` to a component; resolving a tone to a colour is the components' business,
 * and exposing the resolver would be the first step towards features setting colours directly.
 *
 * `FocusRing` is also absent, and for a related reason: it is what interactive primitives draw when the
 * keyboard lands on them, and a feature has no `Pressable` to draw it on — `react-native`'s touchables
 * are banned outside this tree. Exporting it would only invite a feature to build the control that the
 * ban exists to prevent.
 *
 * `field.tsx` is absent on the same principle, and it is the reason that file is lowercase: it holds the
 * shell, the state type and the label/helper/error wrapper that `TextField` and `Select` share, so the
 * two are indistinguishable in a form. That is an implementation detail of *this tree*. A feature that
 * could import `Field` would build a third kind of field, which is precisely the divergence the shared
 * internals exist to prevent — [Rule 1](../../../../CLAUDE.md).
 */
export { Avatar } from './Avatar';
export { Banner } from './Banner';
export { Button } from './Button';
export { Card } from './Card';
export { Checkbox } from './Checkbox';
export { Chip } from './Chip';
export { Divider } from './Divider';
export { FileDropzone } from './FileDropzone';
export { Icon } from './Icon';
export { IconButton } from './IconButton';
export { Marquee } from './Marquee';
export { ProgressSteps } from './ProgressSteps';
export { Screen } from './Screen';
export { Select } from './Select';
export { Skeleton } from './Skeleton';
export { Spinner } from './Spinner';
export { Stack } from './Stack';
export { Text } from './Text';
export { TextField } from './TextField';
export { TextLink } from './TextLink';
export { Wordmark } from './Wordmark';

export type { AvatarSize } from './Avatar';
export type { BannerTone } from './Banner';
export type { ButtonSize, ButtonVariant } from './Button';
export type { CardPadding } from './Card';
export type { ChipSize } from './Chip';
export type { DividerOrientation, DividerTone } from './Divider';
export type { IconName, IconSize } from './Icon';
export type { IconButtonSize } from './IconButton';
export type { MarqueeDirection } from './Marquee';
export type { ScreenSurface } from './Screen';
export type { SelectOption } from './Select';
export type { SkeletonRadius } from './Skeleton';
export type { SpinnerSize, SpinnerTone } from './Spinner';
export type { SpacingToken, StackAlign, StackDirection, StackJustify } from './Stack';
export type { TextAlign } from './Text';
export type {
  TextFieldAutofill,
  TextFieldCapitalization,
  TextFieldKeyboard,
  TextFieldReturnKey,
} from './TextField';
export type { Tone } from './tone';

/**
 * `Sheet` — the modal surface that rises from the bottom of the screen. Filters, pickers, quick
 * actions, and any secondary flow that would break the reading order if it took a full route.
 *
 * ## Why this exists in `design-system` rather than a feature
 *
 * A sheet is the third surface the app has, after a screen and a card, and every screen that ever
 * needs one wants the same handle, the same corner radius, the same backdrop opacity and the same
 * spring settling on release. Distributing those decisions across features is how the app ends up
 * with three different-looking sheets in three different flows.
 *
 * ## Why we wrap `@gorhom/bottom-sheet` rather than expose it
 *
 * The library is powerful — every knob is configurable — and that is exactly why product code must
 * not reach it directly. Exposing `BottomSheetProps` at a call site means the corner radius of one
 * filter drawer is a screen-owned decision, and the identity of the sheet across the app is now a
 * search-and-replace over the feature tree instead of an edit here. The wrapper picks the design
 * language's answer for the visual props and forwards only what a screen legitimately owns: the
 * snap heights and the content.
 *
 * ## Backdrop and dismissal
 *
 * The backdrop dims to `rgba(0,0,0,0.42)` — dark enough that the surface reads as modal, light
 * enough that the content behind is still recognisable. Tapping it closes the sheet, which is what
 * a modal surface must do to satisfy iOS and Android conventions alike. The swipe-down gesture is
 * the library's own and needs no wiring here.
 */
import { forwardRef, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import { createStyles, useTheme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

import type { ReactNode } from 'react';
import type {
  BottomSheetBackdropProps,
  BottomSheetProps,
} from '@gorhom/bottom-sheet';

export type SheetRef = BottomSheet;

interface SheetProps {
  /**
   * Heights the sheet settles at, from smallest to largest. Percentages read as fractions of the
   * screen; absolute numbers are point values. Two is the common case — a compact and an expanded
   * position — and a single number pins the sheet to that one height.
   */
  readonly snapPoints: readonly (string | number)[];
  /** Rendered inside the sheet. Wrap in `Sheet.ScrollView` when the content might overflow. */
  readonly children: ReactNode;
  /**
   * Fired when the sheet closes via swipe, backdrop tap, or a call to `close()`. Not fired on
   * programmatic snap changes.
   */
  readonly onClose?: () => void;
  /**
   * Whether the sheet mounts in the closed position. Defaults to closed; a screen calls
   * `sheetRef.current?.expand()` or `.snapToIndex(n)` to open.
   */
  readonly initialIndex?: BottomSheetProps['index'];
}

const useStyles = createStyles((t) => ({
  handle: {
    // 36 wide, 4 tall — the platform-neutral pull affordance. Slightly deeper radius than the
    // handle needs, so the ends read as soft rather than clipped.
    width: 36,
    height: 4,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.border.strong,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: t.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.md,
    gap: t.spacing.md,
  },
  headerTitle: { flex: 1 },
  content: {
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.xl,
  },
}));

/**
 * The dimmed layer under the sheet. Fading in over the sheet's own animation is what gives the
 * open transition its "settle" feel — the backdrop is not present until the sheet has committed to
 * moving.
 */
function Backdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.42}
      pressBehavior="close"
    />
  );
}

interface SheetHeaderProps {
  readonly title: string;
  readonly onClose?: () => void;
}

function SheetHeader({ title, onClose }: SheetHeaderProps) {
  const styles = useStyles();

  return (
    <View style={styles.header}>
      <View style={styles.headerTitle}>
        <Text variant="title3" tone="heading">
          {title}
        </Text>
      </View>
      {onClose !== undefined ? (
        <IconButton name="close" accessibilityLabel="Close" onPress={onClose} tone="secondary" />
      ) : null}
    </View>
  );
}

interface SheetContentProps {
  readonly children: ReactNode;
}

/** For content that fits within the sheet's snap height. */
function SheetContent({ children }: SheetContentProps) {
  const styles = useStyles();
  return <BottomSheetView style={styles.content}>{children}</BottomSheetView>;
}

/** For content that might overflow the sheet's snap height. Handles inner scrolling correctly. */
function SheetScrollView({ children }: SheetContentProps) {
  const styles = useStyles();
  return (
    <BottomSheetScrollView contentContainerStyle={styles.content}>{children}</BottomSheetScrollView>
  );
}

const SheetInner = forwardRef<SheetRef, SheetProps>(function SheetInner(
  { snapPoints, children, onClose, initialIndex = -1 },
  ref
) {
  const theme = useTheme();
  const styles = useStyles();

  const points = useMemo(() => [...snapPoints], [snapPoints]);

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1) onClose?.();
    },
    [onClose]
  );

  const renderHandle = useCallback(
    () => (
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>
    ),
    [styles.handle, styles.handleContainer]
  );

  return (
    <BottomSheet
      ref={ref}
      index={initialIndex}
      snapPoints={points}
      onChange={handleChange}
      enablePanDownToClose
      backdropComponent={Backdrop}
      handleComponent={renderHandle}
      backgroundStyle={{
        backgroundColor: theme.colors.surface.primary,
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
      }}
    >
      {children}
    </BottomSheet>
  );
});

/**
 * Compound component API. Screens compose `Sheet.Header`, one of `Sheet.Content` / `Sheet.ScrollView`,
 * and — where present — `Sheet.Footer` inside a `Sheet`. Keeping the sub-components as static
 * properties of `Sheet` means the whole vocabulary is discoverable from one import.
 */
type SheetComponent = typeof SheetInner & {
  Header: typeof SheetHeader;
  Content: typeof SheetContent;
  ScrollView: typeof SheetScrollView;
};

export const Sheet = SheetInner as SheetComponent;
Sheet.Header = SheetHeader;
Sheet.Content = SheetContent;
Sheet.ScrollView = SheetScrollView;

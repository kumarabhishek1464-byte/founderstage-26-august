/**
 * `HeroPersonaCollage` — floating founder-ecosystem member cards that appear and disappear
 * in a staggered loop. Matches the Circle-by-CRED signed-out reference layout.
 *
 * Two animation layers per card, so the motion reads as "somebody stepped into frame" rather
 * than "a picture opacity crossfaded":
 *
 *   1. Image layer. Fades and springs in on entry, fades and scales down on exit.
 *   2. Label pill layer. Slides up from below and fades in ~220 ms after the image, and leaves
 *      first on exit — the way a name tag reads after a face, and un-reads before it.
 *
 * Every cycle picks a new persona from the pool and a new size within a small variance so the
 * layout breathes without moving. The visible gap between exit and re-entry is deliberate:
 * empty space is part of the composition, not an animation seam to be hidden.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';

import { createStyles, useTheme } from '../theme';
import { Text } from './Text';

import type { StyleProp, ViewStyle } from 'react-native';

// `useNativeDriver: true` on web moves the animation off the JS thread it does not have,
// producing a warning per animation. Keep it native-only.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface Persona {
  readonly id: string;
  readonly role: string;
  readonly imageUri: string;
}

// Startup-ecosystem roles paired with license-free Pexels portraits.
// The pool is intentionally larger than the number of slots (18 > 9) so cycling has room
// to avoid immediate repeats without a coordination table between slots.
const PERSONA_POOL: readonly Persona[] = [
  {
    id: 'founder-1',
    role: 'Founder',
    imageUri:
      'https://images.pexels.com/photos/12311562/pexels-photo-12311562.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'cofounder-1',
    role: 'Co-founder',
    imageUri:
      'https://images.pexels.com/photos/30496625/pexels-photo-30496625.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'investor-1',
    role: 'Investor',
    imageUri:
      'https://images.pexels.com/photos/12989198/pexels-photo-12989198.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'angel-1',
    role: 'Angel Investor',
    imageUri:
      'https://images.pexels.com/photos/37148308/pexels-photo-37148308.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'mentor-1',
    role: 'Mentor',
    imageUri:
      'https://images.pexels.com/photos/38197025/pexels-photo-38197025.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'advisor-1',
    role: 'Advisor',
    imageUri:
      'https://images.pexels.com/photos/27086916/pexels-photo-27086916.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'coach-1',
    role: 'Coach',
    imageUri:
      'https://images.pexels.com/photos/13801472/pexels-photo-13801472.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'innovator-1',
    role: 'Innovator',
    imageUri:
      'https://images.pexels.com/photos/30161439/pexels-photo-30161439.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'operator-1',
    role: 'Operator',
    imageUri:
      'https://images.pexels.com/photos/18032391/pexels-photo-18032391.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'product-lead',
    role: 'Product Lead',
    imageUri:
      'https://images.pexels.com/photos/37070438/pexels-photo-37070438.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'growth-lead',
    role: 'Growth Lead',
    imageUri:
      'https://images.pexels.com/photos/29852895/pexels-photo-29852895.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'builder',
    role: 'Builder',
    imageUri:
      'https://images.pexels.com/photos/37218483/pexels-photo-37218483.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'vc-partner',
    role: 'VC Partner',
    imageUri:
      'https://images.pexels.com/photos/39058025/pexels-photo-39058025.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'scout',
    role: 'Scout',
    imageUri:
      'https://images.pexels.com/photos/10174456/pexels-photo-10174456.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'solopreneur',
    role: 'Solopreneur',
    imageUri:
      'https://images.pexels.com/photos/8872700/pexels-photo-8872700.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'community-lead',
    role: 'Community Lead',
    imageUri:
      'https://images.pexels.com/photos/37079379/pexels-photo-37079379.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'engineer',
    role: 'Engineer',
    imageUri:
      'https://images.pexels.com/photos/12311567/pexels-photo-12311567.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    id: 'designer',
    role: 'Designer',
    imageUri:
      'https://images.pexels.com/photos/11655430/pexels-photo-11655430.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
];

interface SlotLayout {
  /** Card centre X as a fraction of the container width. */
  readonly cx: number;
  /** Card centre Y as a fraction of the container height. */
  readonly cy: number;
  /** Card width as a fraction of the container width. */
  readonly width: number;
  /** Only one slot renders the CRED-signature "..." chat pill. */
  readonly showChatPill?: boolean;
  /** Initial delay before this slot's first appear, in ms. */
  readonly startDelay: number;
  /** Visible dwell time, in ms. Each slot is different so their cycles never sync. */
  readonly holdMs: number;
}

// Nine slots — three loose rows around the central Angel Investor. Coordinates were chosen
// against the reference at 375-wide; other widths scale proportionally.
const SLOTS: readonly SlotLayout[] = [
  { cx: 0.5, cy: 0.11, width: 0.3, startDelay: 0, holdMs: 4200 },
  { cx: 0.19, cy: 0.24, width: 0.26, startDelay: 260, holdMs: 4600 },
  { cx: 0.81, cy: 0.24, width: 0.26, startDelay: 520, holdMs: 3900 },
  { cx: 0.5, cy: 0.42, width: 0.29, showChatPill: true, startDelay: 780, holdMs: 5200 },
  { cx: 0.16, cy: 0.5, width: 0.24, startDelay: 1040, holdMs: 4400 },
  { cx: 0.84, cy: 0.5, width: 0.24, startDelay: 1300, holdMs: 4100 },
  { cx: 0.5, cy: 0.68, width: 0.27, startDelay: 1560, holdMs: 4800 },
  { cx: 0.18, cy: 0.75, width: 0.24, startDelay: 1820, holdMs: 4300 },
  { cx: 0.82, cy: 0.75, width: 0.25, startDelay: 2080, holdMs: 4700 },
];

const CARD_ASPECT = 1.15;
const SIZE_VARIANCE_MIN = 0.92;
const SIZE_VARIANCE_RANGE = 0.16;
const RE_APPEAR_GAP_MIN = 650;
const RE_APPEAR_GAP_RANGE = 550;

const useStyles = createStyles((t) => ({
  wrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface.tertiary,
    overflow: 'hidden',
    shadowColor: t.colors.text.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  labelWrapper: {
    position: 'absolute',
    bottom: -t.spacing.xs,
    left: -t.spacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface.primary,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 6,
    borderRadius: t.radius.full,
    shadowColor: t.colors.text.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  labelDot: {
    width: 6,
    height: 6,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.text.accent,
    marginRight: t.spacing.xxs,
  },
  chatPill: {
    position: 'absolute',
    right: -t.spacing.md,
    top: '30%',
    backgroundColor: t.colors.surface.primary,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 6,
    borderRadius: t.radius.full,
    shadowColor: t.colors.text.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 34,
  },
  chatPillText: {
    letterSpacing: 2,
    lineHeight: 12,
  },
}));

interface AnimatedCardProps {
  readonly slot: SlotLayout;
  readonly slotIndex: number;
  readonly containerWidth: number;
  readonly containerHeight: number;
}

function AnimatedCard({ slot, slotIndex, containerWidth, containerHeight }: AnimatedCardProps) {
  const styles = useStyles();
  const theme = useTheme();

  // Layer 1: the image card itself. `useState(() => new Animated.Value(...))` rather than
  // `useRef` because the React Compiler lint bans reading a ref's current value during render,
  // and an `Animated.Value` object is passed straight to `style` from render.
  const [imageOpacity] = useState(() => new Animated.Value(0));
  const [imageScale] = useState(() => new Animated.Value(0.7));

  // Layer 2: the name pill. Springs up from below the card, arrives slightly after the face.
  const [labelOpacity] = useState(() => new Animated.Value(0));
  const [labelTranslate] = useState(() => new Animated.Value(10));

  // Current persona and size multiplier. Both change on every cycle so a re-appearing card
  // reads as a different person at a slightly different size, per the design brief.
  const [persona, setPersona] = useState<Persona>(
    () => PERSONA_POOL[slotIndex % PERSONA_POOL.length]!
  );
  const [sizeMultiplier, setSizeMultiplier] = useState(1);

  useEffect(() => {
    let disposed = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Rotate this slot's own cursor through the pool with a prime step size so consecutive
    // cycles pick visibly different faces even before the parent's shuffle kicks in.
    let cursor = slotIndex;

    const scheduleNext = (delay: number, run: () => void) => {
      const t = setTimeout(() => {
        if (!disposed) run();
      }, delay);
      timers.push(t);
    };

    const appear = () => {
      Animated.parallel([
        Animated.timing(imageOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(imageScale, {
          toValue: 1,
          friction: 6.5,
          tension: 55,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.sequence([
          Animated.delay(220),
          Animated.parallel([
            Animated.timing(labelOpacity, {
              toValue: 1,
              duration: 320,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.spring(labelTranslate, {
              toValue: 0,
              friction: 7,
              tension: 90,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
        ]),
      ]).start();

      scheduleNext(slot.holdMs, disappear);
    };

    const disappear = () => {
      Animated.parallel([
        // Label leaves first: the name tag hides before the face is fully gone.
        Animated.parallel([
          Animated.timing(labelOpacity, {
            toValue: 0,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(labelTranslate, {
            toValue: 10,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.sequence([
          Animated.delay(80),
          Animated.parallel([
            Animated.timing(imageOpacity, {
              toValue: 0,
              duration: 360,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(imageScale, {
              toValue: 0.85,
              duration: 360,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
        ]),
      ]).start(() => {
        if (disposed) return;

        // Off-screen swap. New face, new size — same slot.
        cursor = (cursor + 5) % PERSONA_POOL.length;
        setPersona(PERSONA_POOL[cursor]!);
        setSizeMultiplier(SIZE_VARIANCE_MIN + Math.random() * SIZE_VARIANCE_RANGE);
        imageScale.setValue(0.72);

        const gap = RE_APPEAR_GAP_MIN + Math.random() * RE_APPEAR_GAP_RANGE;
        scheduleNext(gap, appear);
      });
    };

    // Initial staggered entrance.
    scheduleNext(slot.startDelay, appear);

    return () => {
      disposed = true;
      for (const t of timers) clearTimeout(t);
    };
  }, [imageOpacity, imageScale, labelOpacity, labelTranslate, slot.holdMs, slot.startDelay, slotIndex]);

  const baseWidth = containerWidth * slot.width;
  const width = Math.round(baseWidth * sizeMultiplier);
  const height = Math.round(width * CARD_ASPECT);
  const left = Math.round(containerWidth * slot.cx - width / 2);
  const top = Math.round(containerHeight * slot.cy - height / 2);

  const positionStyle: StyleProp<ViewStyle> = { top, left, width, height };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        positionStyle,
        { opacity: imageOpacity, transform: [{ scale: imageScale }] },
      ]}
      pointerEvents="none"
    >
      <View style={styles.card}>
        <Image
          source={{ uri: persona.imageUri }}
          style={styles.image}
          contentFit="cover"
          transition={theme.motion.duration.medium}
        />
      </View>

      <Animated.View
        style={[
          styles.labelWrapper,
          { opacity: labelOpacity, transform: [{ translateY: labelTranslate }] },
        ]}
      >
        <View style={styles.labelDot} />
        <Text variant="caption" tone="heading">
          {persona.role}
        </Text>
      </Animated.View>

      {slot.showChatPill ? (
        <Animated.View style={[styles.chatPill, { opacity: labelOpacity }]}>
          <Text variant="caption" tone="tertiary" style={styles.chatPillText}>
            •••
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export function HeroPersonaCollage() {
  const { width: windowWidth } = useWindowDimensions();

  // Cap at 420 so on tablet the collage stays composed rather than spreading edge to edge.
  const containerWidth = Math.min(windowWidth, 420);
  const containerHeight = Math.round(containerWidth * 1.32);

  return (
    <View
      style={{
        width: containerWidth,
        height: containerHeight,
        alignSelf: 'center',
        position: 'relative',
      }}
    >
      {SLOTS.map((slot, index) => (
        <AnimatedCard
          key={`slot-${index}`}
          slot={slot}
          slotIndex={index}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      ))}
    </View>
  );
}

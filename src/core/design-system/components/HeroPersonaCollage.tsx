/**
 * `HeroPersonaCollage` — dynamic floating circular member portrait bubbles with role badges.
 *
 * Implements the signature "Circle by CRED" experience:
 * - 9 circular member portrait bubbles with healthy, expansive spacing matching the reference layout.
 * - Layered badges on key cards ("Founder mode", "All things parenting", and "..." reaction pill).
 * - Auto-rotation: cards dynamically disappear with a gentle scale/fade out, swap to a new persona from the pool,
 *   and spring bounce in.
 * - Continuous subtle floating breathing motion for an alive, organic presence.
 * - Responsive layout adapting smoothly to mobile, tablet, and desktop viewports.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';

import { createStyles, useTheme } from '../theme';
import { Text } from './Text';

import type { StyleProp, ViewStyle } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export interface Persona {
  readonly id: string;
  readonly role: string;
  readonly badgeText?: string;
  readonly imageUri: string;
}

// Extensive pool of diverse founder, investor, mentor, and builder personas
const PERSONA_POOL: readonly Persona[] = [
  {
    id: 'p1',
    role: 'Founder',
    imageUri:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p2',
    role: 'Co-founder',
    imageUri:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p3',
    role: 'Investor',
    badgeText: 'Founder\nmode',
    imageUri:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p4',
    role: 'Angel Investor',
    imageUri:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p5',
    role: 'Mentor',
    imageUri:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p6',
    role: 'Advisor',
    imageUri:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p7',
    role: 'Coach',
    badgeText: 'All things\nparenting',
    imageUri:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p8',
    role: 'Innovator',
    imageUri:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p9',
    role: 'Operator',
    imageUri:
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p10',
    role: 'Tech Lead',
    imageUri:
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p11',
    role: 'Venture Partner',
    badgeText: 'Series A\nlead',
    imageUri:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p12',
    role: 'Product Lead',
    imageUri:
      'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p13',
    role: 'Growth VP',
    badgeText: '0 to 1M\nusers',
    imageUri:
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p14',
    role: 'AI Researcher',
    imageUri:
      'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=500&auto=format&fit=crop&q=85',
  },
  {
    id: 'p15',
    role: 'Design Partner',
    imageUri:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=85',
  },
];

interface CircularSlotLayout {
  readonly topPercent: number;
  readonly leftPercent?: number;
  readonly rightPercent?: number;
  readonly sizeRatio: number;
  readonly showDotsPill?: boolean;
}

// 9 circular bubble slots with healthy, un-congested spacing matching the reference layout
const CIRCULAR_SLOTS: readonly CircularSlotLayout[] = [
  // 0: Top-center (Large Founder)
  { topPercent: 0.02, leftPercent: 0.35, sizeRatio: 0.3 },
  // 1: Top-left (Medium Co-founder with ... dots pill)
  { topPercent: 0.14, leftPercent: 0.03, sizeRatio: 0.275, showDotsPill: true },
  // 2: Top-right (Medium-large Investor with "Founder mode" badge)
  { topPercent: 0.15, rightPercent: 0.03, sizeRatio: 0.28 },
  // 3: Center (Medium Angel Investor)
  { topPercent: 0.33, leftPercent: 0.375, sizeRatio: 0.25 },
  // 4: Mid-left (Small-medium Mentor)
  { topPercent: 0.44, leftPercent: 0.04, sizeRatio: 0.225 },
  // 5: Mid-right (Large-medium Advisor)
  { topPercent: 0.42, rightPercent: 0.03, sizeRatio: 0.28 },
  // 6: Lower-center (Large Coach with "All things parenting" badge)
  { topPercent: 0.55, leftPercent: 0.345, sizeRatio: 0.305 },
  // 7: Lower-left (Small Innovator)
  { topPercent: 0.72, leftPercent: 0.11, sizeRatio: 0.155 },
  // 8: Lower-right (Small Operator)
  { topPercent: 0.74, rightPercent: 0.11, sizeRatio: 0.165 },
];

const useStyles = createStyles((t) => ({
  circleWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCard: {
    width: '100%',
    height: '100%',
    borderRadius: t.radius.full,
    backgroundColor: t.colors.surface.tertiary,
    overflow: 'hidden',
    shadowColor: t.colors.text.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 2,
    borderColor: t.colors.surface.primary,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: t.radius.full,
  },
  badge: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: t.colors.surface.primary,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 5,
    borderRadius: t.radius.md,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    shadowColor: t.colors.text.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    textAlign: 'center',
  },
  dotsPill: {
    position: 'absolute',
    right: -4,
    bottom: 6,
    backgroundColor: t.colors.surface.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: t.radius.full,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    shadowColor: t.colors.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
}));

interface AnimatedCircleCardProps {
  readonly slot: CircularSlotLayout;
  readonly persona: Persona;
  readonly slotIndex: number;
  readonly containerWidth: number;
  readonly containerHeight: number;
}

function AnimatedCircleCard({
  slot,
  persona,
  slotIndex,
  containerWidth,
  containerHeight,
}: AnimatedCircleCardProps) {
  const styles = useStyles();
  const theme = useTheme();

  // Animation values stored in state for stable identity and strict React refs compliance
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));
  const [floatAnim] = useState(() => new Animated.Value(0));

  // Current displaying persona in this card
  const [currentPersona, setCurrentPersona] = useState(persona);

  // Staggered continuous breathing float for organic feel
  useEffect(() => {
    const delay = (slotIndex % 3) * 380;
    const duration = 2800 + (slotIndex % 4) * 300;

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
          delay,
        }),
        Animated.timing(floatAnim, {
          toValue: 3,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    floatLoop.start();
    return () => {
      floatLoop.stop();
    };
  }, [floatAnim, slotIndex]);

  // Premium CRED Circle transition: Smooth disappear -> swap persona -> spring appear
  useEffect(() => {
    if (persona.id === currentPersona.id) {
      return;
    }

    // Step 1: Smooth fade & scale out
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.75,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      // Step 2: Swap the persona data
      setCurrentPersona(persona);

      // Step 3: Spring bounce in with new persona
      scale.setValue(0.7);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 5.5,
          tension: 48,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    });
  }, [persona, currentPersona.id, scale, opacity]);

  const circleDiameter = Math.round(containerWidth * slot.sizeRatio);
  const topPos = Math.round(containerHeight * slot.topPercent);

  const posStyle: StyleProp<ViewStyle> = {
    top: topPos,
    width: circleDiameter,
    height: circleDiameter,
    ...(slot.leftPercent !== undefined
      ? { left: Math.round(containerWidth * slot.leftPercent) }
      : {}),
    ...(slot.rightPercent !== undefined
      ? { right: Math.round(containerWidth * slot.rightPercent) }
      : {}),
  };

  const badgeText = currentPersona.badgeText;

  return (
    <Animated.View
      style={[
        styles.circleWrapper,
        posStyle,
        {
          transform: [{ translateY: floatAnim }, { scale }],
          opacity,
        },
      ]}
    >
      <View style={styles.circleCard}>
        <Image
          source={{ uri: currentPersona.imageUri }}
          style={styles.image}
          contentFit="cover"
          transition={theme.motion.duration.fast}
        />
      </View>

      {/* Floating badge for prominent personas */}
      {badgeText !== undefined ? (
        <View style={styles.badge}>
          <Text variant="caption" tone="heading" style={styles.badgeText}>
            {badgeText}
          </Text>
        </View>
      ) : null}

      {/* Floating 3-dots conversation pill */}
      {slot.showDotsPill ? (
        <View style={styles.dotsPill}>
          <Text variant="caption" tone="secondary">
            ...
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

export function HeroPersonaCollage() {
  const { width: windowWidth } = useWindowDimensions();

  // Expansive width and height that gives generous breathing room to all 9 circles
  const containerWidth = Math.min(windowWidth - 16, 400);
  const containerHeight = Math.round(containerWidth * 1.28);

  // Active personas occupying the 9 slots
  const [activePersonas, setActivePersonas] = useState<readonly Persona[]>(() =>
    PERSONA_POOL.slice(0, 9)
  );

  // Pool rotation index tracker
  const nextPoolIndex = useRef(9);

  // Periodic card replacement: Select a slot, animate out and in a new persona
  useEffect(() => {
    const interval = setInterval(() => {
      // Pick a random slot to refresh
      const targetSlot = Math.floor(Math.random() * 9);

      // Get next persona from the pool
      const newPersona = PERSONA_POOL[nextPoolIndex.current % PERSONA_POOL.length];
      nextPoolIndex.current += 1;

      if (newPersona !== undefined) {
        setActivePersonas((prev) => {
          const next = [...prev];
          next[targetSlot] = newPersona;
          return next;
        });
      }
    }, 2400);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <View
      style={{
        width: containerWidth,
        height: containerHeight,
        alignSelf: 'center',
        position: 'relative',
      }}
    >
      {CIRCULAR_SLOTS.map((slot, index) => {
        const persona = activePersonas[index] ?? PERSONA_POOL[index]!;
        return (
          <AnimatedCircleCard
            key={`slot-${index}`}
            slot={slot}
            persona={persona}
            slotIndex={index}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
          />
        );
      })}
    </View>
  );
}

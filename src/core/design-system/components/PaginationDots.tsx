/**
 * `PaginationDots` — stepper dots for multi-step onboarding flows.
 */
import { View } from 'react-native';

import { createStyles } from '../theme';

import type { StyleProp, ViewStyle } from 'react-native';

interface PaginationDotsProps {
  readonly total?: number;
  readonly current: number;
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.border.strong,
  },
  dotActive: {
    backgroundColor: t.colors.text.heading,
  },
}));

export function PaginationDots({ total = 4, current, style }: PaginationDotsProps) {
  const styles = useStyles();

  return (
    <View style={[styles.container, style]} accessibilityRole="none">
      {Array.from({ length: total }, (_, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === current;
        return <View key={stepNumber} style={[styles.dot, isActive && styles.dotActive]} />;
      })}
    </View>
  );
}

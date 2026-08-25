/**
 * `Wordmark` — the "Circle BETA" header lockup matching the brand identity.
 */
import { View, Text as RNText } from 'react-native';

import { createStyles } from '../theme';
import { CircleLogo } from './CircleLogo';

import type { StyleProp, ViewStyle } from 'react-native';

interface WordmarkProps {
  readonly style?: StyleProp<ViewStyle>;
  readonly hideBeta?: boolean;
}

const useStyles = createStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  title: {
    ...t.typography.title3,
    fontWeight: t.typography.weight.bold,
    color: t.colors.text.heading,
    letterSpacing: -0.3,
  },
  beta: {
    ...t.typography.caption,
    fontSize: 11,
    fontWeight: t.typography.weight.medium,
    color: t.colors.text.tertiary,
    letterSpacing: 0.5,
  },
}));

export function Wordmark({ style, hideBeta = false }: WordmarkProps) {
  const styles = useStyles();

  return (
    <View style={[styles.container, style]} accessibilityRole="header" accessibilityLabel="Circle">
      <CircleLogo size={24} />
      <RNText style={styles.title}>Circle</RNText>
      {!hideBeta && <RNText style={styles.beta}>BETA</RNText>}
    </View>
  );
}

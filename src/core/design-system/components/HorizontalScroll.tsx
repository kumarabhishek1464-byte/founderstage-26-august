/**
 * `HorizontalScroll` — a horizontal scrolling container primitive with safe gutter padding.
 */
import { ScrollView } from 'react-native';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

interface HorizontalScrollProps {
  readonly children: ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly style?: StyleProp<ViewStyle>;
  readonly showsIndicator?: boolean;
}

export function HorizontalScroll({
  children,
  contentStyle,
  style,
  showsIndicator = false,
}: HorizontalScrollProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={showsIndicator}
      style={style}
      contentContainerStyle={contentStyle}
    >
      {children}
    </ScrollView>
  );
}

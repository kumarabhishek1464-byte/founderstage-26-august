/**
 * `CircleLogo` — the spiral/swirl mark representing Circle.
 */
import Svg, { Path } from 'react-native-svg';

import { hiddenFromAssistiveTech } from '../a11y';

interface CircleLogoProps {
  readonly size?: number;
  readonly color?: string;
}

export function CircleLogo({ size = 28, color = '#111111' }: CircleLogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      {...hiddenFromAssistiveTech(true)}
    >
      <Path
        d="M16 4C19.3137 4 22.3137 5.34315 24.4853 7.51472M28 16C28 19.3137 26.6569 22.3137 24.4853 24.4853M16 28C12.6863 28 9.68629 26.6569 7.51472 24.4853M4 16C4 12.6863 5.34315 9.68629 7.51472 7.51472"
        stroke={color}
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <Path
        d="M16 8.5C18.0711 8.5 19.9462 9.33959 21.3033 10.6967M23.5 16C23.5 18.0711 22.6604 19.9462 21.3033 21.3033M16 23.5C13.9289 23.5 12.0538 22.6604 10.6967 21.3033M8.5 16C8.5 13.9289 9.33959 12.0538 10.6967 10.6967"
        stroke={color}
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <Path
        d="M16 13C16.8284 13 17.5784 13.3358 18.1213 13.8787M19 16C19 16.8284 18.6642 17.5784 18.1213 18.1213M16 19C15.1716 19 14.4216 18.6642 13.8787 18.1213M13 16C13 15.1716 13.3358 14.4216 13.8787 13.8787"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </Svg>
  );
}

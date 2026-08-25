/**
 * `ShieldLogoIcon` — the shield monogram with 'C' for the primary CTA button.
 */
import Svg, { Path } from 'react-native-svg';

import { hiddenFromAssistiveTech } from '../a11y';

interface ShieldLogoIconProps {
  readonly size?: number;
  readonly color?: string;
}

export function ShieldLogoIcon({ size = 20, color = '#FFFFFF' }: ShieldLogoIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      {...hiddenFromAssistiveTech(true)}
    >
      {/* Outer Shield */}
      <Path
        d="M12 2L4 5V11C4 16.52 7.41 21.61 12 22.88C16.59 21.61 20 16.52 20 11V5L12 2Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner 'C' shape */}
      <Path
        d="M14.5 9.5C13.8 8.8 12.8 8.5 11.8 8.5C9.6 8.5 8 10.1 8 12.3C8 14.5 9.6 16.1 11.8 16.1C12.8 16.1 13.8 15.8 14.5 15.1"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

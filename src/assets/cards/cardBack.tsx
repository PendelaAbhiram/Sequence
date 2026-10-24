// ─────────────────────────────────────────────────────────────────────────────
// Ornate Navy & Gold Playing Card Back SVG
// Suitable for opponent hand previews, draw pile deck, and card back reveals
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { G, Rect, Path, Circle, Line } from 'react-native-svg';

export const OrnateCardBack: React.FC = () => {
  return (
    <G>
      {/* Deep Royal Navy Card Base */}
      <Rect
        x="1.5"
        y="1.5"
        width="97"
        height="137"
        rx="6"
        ry="6"
        fill="#0B1B2B"
        stroke="#D4AF37"
        strokeWidth="1.8"
      />

      {/* Outer White / Cream Inset Margin */}
      <Rect
        x="4.5"
        y="4.5"
        width="91"
        height="131"
        rx="4.5"
        ry="4.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="0.8"
        strokeOpacity="0.85"
      />

      {/* Decorative Gold Inner Frame */}
      <Rect
        x="7.5"
        y="7.5"
        width="85"
        height="125"
        rx="3"
        ry="3"
        fill="#0E2238"
        stroke="#D4AF37"
        strokeWidth="1.2"
      />

      {/* Corner Filigree Flourishes */}
      <Path d="M 8 18 Q 18 18 18 8" stroke="#F5C84C" strokeWidth="1" fill="none" />
      <Path d="M 92 18 Q 82 18 82 8" stroke="#F5C84C" strokeWidth="1" fill="none" />
      <Path d="M 8 122 Q 18 122 18 132" stroke="#F5C84C" strokeWidth="1" fill="none" />
      <Path d="M 92 122 Q 82 122 82 132" stroke="#F5C84C" strokeWidth="1" fill="none" />

      {/* Diamond / Geometric Lattice Pattern */}
      <G opacity="0.4" stroke="#F5C84C" strokeWidth="0.75" fill="none">
        {/* Forward Diagonals */}
        <Line x1="10" y1="15" x2="85" y2="90" />
        <Line x1="10" y1="35" x2="85" y2="110" />
        <Line x1="10" y1="55" x2="85" y2="130" />
        <Line x1="20" y1="10" x2="90" y2="80" />
        <Line x1="40" y1="10" x2="90" y2="60" />
        <Line x1="10" y1="75" x2="65" y2="130" />

        {/* Backward Diagonals */}
        <Line x1="90" y1="15" x2="15" y2="90" />
        <Line x1="90" y1="35" x2="15" y2="110" />
        <Line x1="90" y1="55" x2="15" y2="130" />
        <Line x1="80" y1="10" x2="10" y2="80" />
        <Line x1="60" y1="10" x2="10" y2="60" />
        <Line x1="90" y1="75" x2="35" y2="130" />
      </G>

      {/* Center Medallion Shield (navy & gold) */}
      <Circle cx="50" cy="70" r="22" fill="#0B1B2B" stroke="#D4AF37" strokeWidth="1.6" />
      <Circle
        cx="50"
        cy="70"
        r="18.5"
        fill="none"
        stroke="#F5C84C"
        strokeWidth="0.8"
        strokeDasharray="2 2"
      />
      <Circle cx="50" cy="70" r="14" fill="#0E2238" stroke="#D4AF37" strokeWidth="1" />

      {/* Starburst Rays / 8-pointed Compass Rose */}
      <Path
        d="M 50 58 L 52.5 67.5 L 62 70 L 52.5 72.5 L 50 82 L 47.5 72.5 L 38 70 L 47.5 67.5 Z"
        fill="#F5C84C"
      />
      <Circle cx="50" cy="70" r="3.2" fill="#0B1B2B" stroke="#F5C84C" strokeWidth="0.8" />
      <Circle cx="50" cy="70" r="1.4" fill="#F5C84C" />
    </G>
  );
};

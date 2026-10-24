// ─────────────────────────────────────────────────────────────────────────────
// PlayingCard – Reusable Vector Playing Card Component (React Native SVG)
// Memoised for smooth 60fps performance on mid-range devices.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import Svg, {
  Rect,
  Path,
  G,
  Text as SvgText,
} from 'react-native-svg';
import { Rank, Suit } from '../engine/types';
import { SUIT_PATHS, SUIT_COLORS } from '../assets/cards/suitPaths';
import { CourtPanel } from '../assets/cards/faceCards';
import { OrnateCardBack } from '../assets/cards/cardBack';

export interface PlayingCardProps {
  rank?: Rank;
  suit?: Suit;
  size?: number;
  width?: number;
  height?: number;
  isBack?: boolean;
  compact?: boolean;
  isDead?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

interface PipCoord {
  x: number;
  y: number;
  rotated?: boolean;
}

const PIP_LAYOUTS: Record<string, PipCoord[]> = {
  '2': [
    { x: 50, y: 38 },
    { x: 50, y: 102, rotated: true },
  ],
  '3': [
    { x: 50, y: 38 },
    { x: 50, y: 70 },
    { x: 50, y: 102, rotated: true },
  ],
  '4': [
    { x: 32, y: 38 },
    { x: 68, y: 38 },
    { x: 32, y: 102, rotated: true },
    { x: 68, y: 102, rotated: true },
  ],
  '5': [
    { x: 32, y: 38 },
    { x: 68, y: 38 },
    { x: 50, y: 70 },
    { x: 32, y: 102, rotated: true },
    { x: 68, y: 102, rotated: true },
  ],
  '6': [
    { x: 32, y: 38 },
    { x: 68, y: 38 },
    { x: 32, y: 70 },
    { x: 68, y: 70 },
    { x: 32, y: 102, rotated: true },
    { x: 68, y: 102, rotated: true },
  ],
  '7': [
    { x: 32, y: 38 },
    { x: 68, y: 38 },
    { x: 50, y: 54 },
    { x: 32, y: 70 },
    { x: 68, y: 70 },
    { x: 32, y: 102, rotated: true },
    { x: 68, y: 102, rotated: true },
  ],
  '8': [
    { x: 32, y: 38 },
    { x: 68, y: 38 },
    { x: 50, y: 54 },
    { x: 32, y: 70 },
    { x: 68, y: 70 },
    { x: 50, y: 86, rotated: true },
    { x: 32, y: 102, rotated: true },
    { x: 68, y: 102, rotated: true },
  ],
  '9': [
    { x: 32, y: 34 },
    { x: 68, y: 34 },
    { x: 32, y: 58 },
    { x: 68, y: 58 },
    { x: 50, y: 70 },
    { x: 32, y: 82, rotated: true },
    { x: 68, y: 82, rotated: true },
    { x: 32, y: 106, rotated: true },
    { x: 68, y: 106, rotated: true },
  ],
  '10': [
    { x: 32, y: 34 },
    { x: 68, y: 34 },
    { x: 50, y: 47 },
    { x: 32, y: 60 },
    { x: 68, y: 60 },
    { x: 32, y: 80, rotated: true },
    { x: 68, y: 80, rotated: true },
    { x: 50, y: 93, rotated: true },
    { x: 32, y: 106, rotated: true },
    { x: 68, y: 106, rotated: true },
  ],
};

const renderPip = (
  suit: Suit,
  x: number,
  y: number,
  w: number,
  h: number,
  rotated = false,
  key?: string
) => {
  const path = SUIT_PATHS[suit];
  const color = SUIT_COLORS[suit];
  const scale = w / 24;

  const transform = rotated
    ? `translate(${x}, ${y}) rotate(180) translate(${-w / 2}, ${-h / 2}) scale(${scale})`
    : `translate(${x - w / 2}, ${y - h / 2}) scale(${scale})`;

  return <Path key={key} d={path} fill={color} transform={transform} />;
};

export const PlayingCard: React.FC<PlayingCardProps> = React.memo(
  ({
    rank = 'A',
    suit = 'spades',
    size,
    width: customWidth,
    height: customHeight,
    isBack = false,
    compact: forceCompact,
    isDead = false,
    style,
    testID,
    accessibilityLabel,
  }) => {
    // Determine card dimensions (standard playing card aspect ratio: 2.5 x 3.5 = 1 : 1.4)
    const cardWidth = customWidth ?? size ?? 60;
    const cardHeight = customHeight ?? (size ? size * 1.4 : cardWidth * 1.4);

    // Auto-compact if very small (e.g. board cell < 48px)
    const isCompact = forceCompact ?? cardWidth < 48;

    const suitColor = SUIT_COLORS[suit];
    const isFaceCard = rank === 'J' || rank === 'Q' || rank === 'K';
    const isAce = rank === 'A';

    return (
      <View
        testID={testID}
        accessible={Boolean(accessibilityLabel)}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.container,
          { width: cardWidth, height: cardHeight },
          isDead && styles.deadTint,
          style,
        ]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 140"
          preserveAspectRatio="xMidYMid meet"
        >
          {isBack ? (
            <OrnateCardBack />
          ) : (
            <G>
              {/* Card Face: Crisp White with Rounded Corners & Subtle Border */}
              <Rect
                x="1"
                y="1"
                width="98"
                height="138"
                rx="6"
                ry="6"
                fill="#FFFFFF"
                stroke="#CBD5E1"
                strokeWidth="1.2"
              />

              {/* Subtle inner card border line */}
              <Rect
                x="3.5"
                y="3.5"
                width="93"
                height="133"
                rx="4.5"
                ry="4.5"
                fill="none"
                stroke="#F1F5F9"
                strokeWidth="0.8"
              />

              {/* ── Compact Mode (board cells at small scale) ──────────────── */}
              {isCompact ? (
                <G>
                  {/* Top-Left Rank */}
                  <SvgText
                    x="18"
                    y="32"
                    fill={suitColor}
                    fontSize={rank === '10' ? '24' : '28'}
                    fontWeight="900"
                    textAnchor="middle"
                  >
                    {rank}
                  </SvgText>

                  {/* Centered Large Suit Pip */}
                  {renderPip(suit, 50, 72, 38, 38)}

                  {/* Bottom-Right Inverted Rank */}
                  <G transform="rotate(180, 50, 70)">
                    <SvgText
                      x="18"
                      y="32"
                      fill={suitColor}
                      fontSize={rank === '10' ? '24' : '28'}
                      fontWeight="900"
                      textAnchor="middle"
                    >
                      {rank}
                    </SvgText>
                  </G>

                  {/* Jack mini badges in compact mode */}
                  {rank === 'J' && (suit === 'diamonds' || suit === 'clubs') && (
                    <G>
                      <Rect
                        x="20"
                        y="106"
                        width="60"
                        height="16"
                        rx="8"
                        fill="#F59E0B"
                        stroke="#FFFFFF"
                        strokeWidth="1"
                      />
                      <SvgText
                        x="50"
                        y="118"
                        fill="#0F172A"
                        fontSize="9"
                        fontWeight="900"
                        textAnchor="middle"
                      >
                        WILD
                      </SvgText>
                    </G>
                  )}

                  {rank === 'J' && (suit === 'spades' || suit === 'hearts') && (
                    <G>
                      <Rect
                        x="18"
                        y="106"
                        width="64"
                        height="16"
                        rx="8"
                        fill="#DC2626"
                        stroke="#FFFFFF"
                        strokeWidth="1"
                      />
                      <SvgText
                        x="50"
                        y="118"
                        fill="#FFFFFF"
                        fontSize="8.5"
                        fontWeight="900"
                        textAnchor="middle"
                      >
                        REMOVE
                      </SvgText>
                    </G>
                  )}
                </G>
              ) : (
                /* ── Full Detail Mode (Hand Cards, Sheet, Previews) ───────── */
                <G>
                  {/* Top-Left Corner Index (Rank + Suit Pip) */}
                  <SvgText
                    x="11"
                    y="19"
                    fill={suitColor}
                    fontSize={rank === '10' ? '12.5' : '14'}
                    fontWeight="900"
                    textAnchor="middle"
                  >
                    {rank}
                  </SvgText>
                  {renderPip(suit, 11, 29, 9, 9)}

                  {/* Bottom-Right Corner Index (Rotated 180°) */}
                  <G transform="rotate(180, 50, 70)">
                    <SvgText
                      x="11"
                      y="19"
                      fill={suitColor}
                      fontSize={rank === '10' ? '12.5' : '14'}
                      fontWeight="900"
                      textAnchor="middle"
                    >
                      {rank}
                    </SvgText>
                    {renderPip(suit, 11, 29, 9, 9)}
                  </G>

                  {/* Face Cards (J, Q, K) */}
                  {isFaceCard && <CourtPanel rank={rank} suit={suit} />}

                  {/* Large Center Ace */}
                  {isAce && renderPip(suit, 50, 70, 38, 38)}

                  {/* Number Cards (2 - 10) Traditional Pip Layouts */}
                  {!isFaceCard &&
                    !isAce &&
                    PIP_LAYOUTS[rank]?.map((pip, idx) =>
                      renderPip(
                        suit,
                        pip.x,
                        pip.y,
                        13,
                        13,
                        pip.rotated,
                        `pip-${idx}`
                      )
                    )}
                </G>
              )}
            </G>
          )}
        </Svg>
      </View>
    );
  }
);

PlayingCard.displayName = 'PlayingCard';

const styles = StyleSheet.create({
  container: {
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    // Subtle realistic shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  deadTint: {
    opacity: 0.75,
  },
});

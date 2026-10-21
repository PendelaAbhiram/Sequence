// ─────────────────────────────────────────────────────────────────────────────
// HandCardView – Fanned Playing Card with Lift, Jack Badges, & Dead Card Button
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, Suit } from '../engine/types';
import { isTwoEyedJack, isOneEyedJack } from '../engine/deck';
import { palette, radius, typography } from '../theme';
import { useSettingsStore } from '../store/settingsStore';

interface HandCardViewProps {
  card: Card;
  isSelected: boolean;
  isDead: boolean;
  rotationDeg: number;
  onPress: () => void;
  onDiscardDead?: () => void;
  disabled?: boolean;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  spades: '#1E293B',
  clubs: '#334155',
  hearts: '#E5484D',
  diamonds: '#EA580C',
};

export const HandCardView: React.FC<HandCardViewProps> = ({
  card,
  isSelected,
  isDead,
  rotationDeg,
  onPress,
  onDiscardDead,
  disabled = false,
}) => {
  const isWild = isTwoEyedJack(card);
  const isRemove = isOneEyedJack(card);

  const cardSizePref = useSettingsStore((s) => s.cardSize);
  const cardDims =
    cardSizePref === 'compact'
      ? { width: 50, height: 74 }
      : cardSizePref === 'large'
      ? { width: 66, height: 94 }
      : { width: 58, height: 84 };

  const suitColor = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];

  const handleCardPress = () => {
    if (disabled) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onPress();
  };

  const handleDiscardPress = (e: any) => {
    e.stopPropagation();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onDiscardDead?.();
  };

  return (
    <View
      style={[
        styles.cardOuter,
        {
          width: cardDims.width + 2,
          height: cardDims.height + 2,
          transform: [
            { translateY: isSelected ? -20 : isDead ? -8 : 0 },
            { rotate: `${rotationDeg}deg` },
          ],
          zIndex: isSelected ? 99 : 1,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleCardPress}
        disabled={disabled}
        accessibilityLabel={`${card.rank} of ${card.suit}${isWild ? ', Wild Jack' : isRemove ? ', Remove Jack' : ''}${isDead ? ', Dead card' : ''}`}
        style={[
          styles.cardBody,
          { width: cardDims.width, height: cardDims.height },
          isSelected && styles.cardSelected,
          isDead && styles.cardDead,
        ]}
      >
        {/* Top-Left Rank & Suit */}
        <View style={styles.cornerIndicator}>
          <Text style={[styles.cornerRank, { color: suitColor }]}>{card.rank}</Text>
          <Text style={[styles.cornerSuit, { color: suitColor }]}>{symbol}</Text>
        </View>

        {/* Center Symbol / Graphic */}
        <View style={styles.centerGraphic}>
          <Text style={[styles.largeSymbol, { color: suitColor }]}>{symbol}</Text>

          {/* Jack Badges */}
          {isWild && (
            <View style={styles.wildBadge}>
              <Text style={styles.wildBadgeText}>WILD</Text>
            </View>
          )}

          {isRemove && (
            <View style={styles.removeBadge}>
              <Text style={styles.removeBadgeText}>REMOVE</Text>
            </View>
          )}

          {/* Dead Card Badge */}
          {isDead && (
            <View style={styles.deadBadge}>
              <Text style={styles.deadBadgeText}>DEAD</Text>
            </View>
          )}
        </View>

        {/* Bottom-Right Inverted Rank & Suit */}
        <View style={[styles.cornerIndicator, styles.cornerBottomRight]}>
          <Text style={[styles.cornerRank, { color: suitColor }]}>{card.rank}</Text>
          <Text style={[styles.cornerSuit, { color: suitColor }]}>{symbol}</Text>
        </View>
      </TouchableOpacity>

      {/* Discard & Draw Action Button for Dead Cards */}
      {isDead && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleDiscardPress}
          style={styles.discardButton}
        >
          <Text style={styles.discardButtonText}>Discard & Draw</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardOuter: {
    width: 60,
    height: 86,
    marginHorizontal: -4,
    alignItems: 'center',
  },
  cardBody: {
    width: 58,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 3,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    position: 'relative',
  },
  cardSelected: {
    borderColor: palette.gold,
    borderWidth: 2.5,
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 12,
  },
  cardDead: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  cornerIndicator: {
    alignItems: 'center',
    width: 14,
  },
  cornerBottomRight: {
    alignSelf: 'flex-end',
    transform: [{ rotate: '180deg' }],
  },
  cornerRank: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 12,
  },
  cornerSuit: {
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 11,
  },
  centerGraphic: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  largeSymbol: {
    fontSize: 22,
    fontWeight: '900',
  },
  wildBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: -2,
  },
  wildBadgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  removeBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: -2,
  },
  removeBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  deadBadge: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: -2,
  },
  deadBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  discardButton: {
    position: 'absolute',
    bottom: -28,
    backgroundColor: '#B91C1C',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: radius.xs,
    minHeight: 24,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    zIndex: 100,
  },
  discardButtonText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

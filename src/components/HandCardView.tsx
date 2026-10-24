// ─────────────────────────────────────────────────────────────────────────────
// HandCardView – Fanned Real Playing Card with Deal Flip & Realistic Lift
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Card } from '../engine/types';
import { isTwoEyedJack, isOneEyedJack } from '../engine/deck';
import { palette, radius } from '../theme';
import { useSettingsStore } from '../store/settingsStore';
import { PlayingCard } from './PlayingCard';

interface HandCardViewProps {
  card: Card;
  isSelected: boolean;
  isDead: boolean;
  rotationDeg: number;
  onPress: () => void;
  onDiscardDead?: () => void;
  disabled?: boolean;
}

export const HandCardView: React.FC<HandCardViewProps> = React.memo(({
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
      ? { width: 52, height: 74 }
      : cardSizePref === 'large'
      ? { width: 68, height: 96 }
      : { width: 60, height: 86 };

  // ── Worklet-safe Reanimated Shared Values ──────────────────────────────────
  const dealProgress = useSharedValue(0);
  const liftY = useSharedValue(0);

  // Trigger deal flip animation when card mounts or card.id changes
  useEffect(() => {
    dealProgress.value = 0;
    dealProgress.value = withTiming(1, { duration: 380 });
  }, [card.id, dealProgress]);

  // Smooth spring lift when card is selected or marked dead
  useEffect(() => {
    liftY.value = withSpring(isSelected ? -20 : isDead ? -8 : 0, {
      damping: 15,
      stiffness: 240,
    });
  }, [isSelected, isDead, liftY]);

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotateYDeg = (1 - dealProgress.value) * 90;
    return {
      transform: [
        { translateY: liftY.value },
        { rotate: `${rotationDeg}deg` },
        { perspective: 800 },
        { rotateY: `${rotateYDeg}deg` },
        { scale: 0.88 + 0.12 * dealProgress.value },
      ],
    };
  });

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

  const jackLabel = isWild ? ', Wild Jack' : isRemove ? ', Remove Jack' : '';
  const deadLabel = isDead ? ', Dead card' : '';
  const accessibilityLabel = `${card.rank} of ${card.suit}${jackLabel}${deadLabel}`;

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        {
          width: cardDims.width + 4,
          height: cardDims.height + 4,
          zIndex: isSelected ? 99 : 1,
        },
        animatedCardStyle,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handleCardPress}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        style={[
          styles.cardBody,
          { width: cardDims.width, height: cardDims.height },
          isSelected && styles.cardSelected,
          isDead && styles.cardDead,
          disabled && styles.cardDisabled,
        ]}
      >
        <PlayingCard
          rank={card.rank}
          suit={card.suit}
          width={cardDims.width}
          height={cardDims.height}
          compact={false}
          isDead={isDead}
        />
      </TouchableOpacity>

      {/* Discard & Draw Action Button for Dead Cards */}
      {isDead && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleDiscardPress}
          style={styles.discardButton}
          accessibilityLabel="Discard dead card and draw new one"
          accessibilityRole="button"
        >
          <Text style={styles.discardButtonText}>Discard & Draw</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

HandCardView.displayName = 'HandCardView';

const styles = StyleSheet.create({
  cardOuter: {
    marginHorizontal: -5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    // Realistic shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35)',
      },
    }),
  },
  cardSelected: {
    borderColor: palette.gold,
    borderWidth: 2.5,
    // Realistic elevated shadow
    ...Platform.select({
      ios: {
        shadowColor: palette.gold,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.8,
        shadowRadius: 12,
      },
      android: {
        elevation: 14,
      },
      web: {
        boxShadow: `0 8px 16px ${palette.gold}`,
      },
    }),
  },
  cardDead: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  cardDisabled: {
    opacity: 0.55,
  },
  discardButton: {
    position: 'absolute',
    bottom: -28,
    backgroundColor: '#B91C1C',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.xs,
    minHeight: 24,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
      },
    }),
  },
  discardButtonText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

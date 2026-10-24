// ─────────────────────────────────────────────────────────────────────────────
// BoardCellView – Crisp SVG/Vector Card Cell with 60fps Reanimated Effects
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  FadeOut,
  ZoomIn,
} from 'react-native-reanimated';
import { Cell } from '../engine/types';
import { palette } from '../theme';
import { useSettingsStore } from '../store/settingsStore';
import { PlayingCard } from './PlayingCard';

interface BoardCellViewProps {
  cell: Cell;
  size: number;
  isValidTarget: boolean;
  isLastMove: boolean;
  isLastRemove?: boolean;
  isPartOfSequence?: boolean;
  onPress: () => void;
  disabled: boolean;
}


export const BoardCellView: React.FC<BoardCellViewProps> = React.memo(({
  cell,
  size,
  isValidTarget,
  isLastMove,
  isLastRemove = false,
  isPartOfSequence = false,
  onPress,
  disabled,
}) => {
  // ── Reanimated Shared Values for 60fps effects ─────────────────────────────
  const pulseAnim = useSharedValue(0.4);
  const chipDropY = useSharedValue(0);
  const chipScale = useSharedValue(1);

  // Pulsing glow on valid cells
  useEffect(() => {
    if (isValidTarget) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 650 }),
          withTiming(0.35, { duration: 650 })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = 0.4;
    }
  }, [isValidTarget, pulseAnim]);

  // Chip bounce on drop
  useEffect(() => {
    if (isLastMove && cell.chip) {
      chipDropY.value = withSequence(
        withTiming(-32, { duration: 0 }),
        withSpring(0, { damping: 10, stiffness: 220 })
      );
      chipScale.value = withSequence(
        withTiming(1.35, { duration: 0 }),
        withSpring(1, { damping: 11, stiffness: 200 })
      );
    }
  }, [isLastMove, cell.chip, chipDropY, chipScale]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
  }));

  const animatedChipStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: chipDropY.value },
      { scale: chipScale.value },
    ],
  }));

  const colorBlindMode = useSettingsStore((s) => s.colorBlindMode);

  const renderChip = () => {
    if (!cell.chip) return null;

    const chipBg =
      cell.chip === 'red'
        ? palette.red
        : cell.chip === 'blue'
        ? palette.blue
        : palette.green;

    const shapeSymbol =
      cell.chip === 'red' ? '●' : cell.chip === 'blue' ? '■' : '▲';

    const chipDiameter = Math.max(14, size * 0.72);

    return (
      <Animated.View
        style={[
          styles.chipBase,
          {
            width: chipDiameter,
            height: chipDiameter,
            borderRadius: chipDiameter / 2,
            backgroundColor: chipBg,
          },
          cell.locked && styles.lockedChipBorder,
          animatedChipStyle,
        ]}
      >
        {/* Glossy top specular reflection */}
        <View style={[styles.chipHighlight, { borderRadius: chipDiameter / 2 }]} />

        {/* Chip center groove / inset */}
        <View style={styles.chipInnerRing}>
          {cell.locked ? (
            <Text style={styles.lockIcon}>🔒</Text>
          ) : colorBlindMode ? (
            <Text style={[styles.colorBlindShape, { fontSize: Math.max(8, chipDiameter * 0.4) }]}>
              {shapeSymbol}
            </Text>
          ) : (
            <View style={styles.chipDot} />
          )}
        </View>
      </Animated.View>
    );
  };

  if (cell.card === 'CORNER') {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        disabled={disabled || !isValidTarget}
        accessibilityLabel="Wild Corner space"
        accessibilityRole="button"
        style={[
          styles.cellContainer,
          styles.cornerCell,
          { width: size, height: size },
        ]}
      >
        <Text style={[styles.cornerStar, { fontSize: size * 0.44 }]}>★</Text>
        <Text style={[styles.cornerTag, { fontSize: Math.max(7, size * 0.18) }]}>FREE</Text>
      </TouchableOpacity>
    );
  }

  const card = cell.card;
  const suit = card.suit;
  const rank = card.rank;

  const suitName = suit.charAt(0).toUpperCase() + suit.slice(1);
  const rankName = rank === 'A' ? 'Ace' : rank === 'K' ? 'King' : rank === 'Q' ? 'Queen' : rank;
  const chipStatus = cell.chip ? `${cell.chip} chip${cell.locked ? ', locked' : ''}` : 'empty';
  const accessibilityLabel = `${rankName} of ${suitName}, ${chipStatus}`;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || !isValidTarget}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={[
        styles.cellContainer,
        { width: size, height: size },
        isLastMove && styles.lastMoveRing,
        cell.locked && styles.lockedCellGold,
        isPartOfSequence && styles.sequenceSweepCell,
      ]}
    >
      {/* Background card face: Real Playing Card scaled to cell */}
      <PlayingCard
        rank={rank}
        suit={suit}
        width={size}
        height={size}
        compact={size < 48}
        style={styles.cardFace}
      />

      {/* Chip layer with bounce */}
      {renderChip()}

      {/* Target indicator pulsing glow border */}
      {isValidTarget && (
        <Animated.View style={[styles.targetPulseBorder, animatedPulseStyle]} />
      )}

      {/* One-Eyed Jack Shatter / Dissolve Particle Effect */}
      {isLastRemove && (
        <Animated.View
          entering={ZoomIn.duration(400)}
          exiting={FadeOut.duration(400)}
          style={styles.shatterContainer}
          pointerEvents="none"
        >
          <Text style={styles.shatterIcon}>💥</Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  cellContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  cornerCell: {
    backgroundColor: '#073324',
    borderColor: palette.gold,
    borderWidth: 1,
  },
  cornerStar: {
    color: palette.gold,
    fontWeight: '900',
  },
  cornerTag: {
    color: palette.gold,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardFace: {
    width: '100%',
    height: '100%',
  },
  chipBase: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 6,
  },
  lockedChipBorder: {
    borderColor: palette.gold,
    borderWidth: 2.5,
  },
  chipHighlight: {
    position: 'absolute',
    top: 1,
    left: 2,
    right: 2,
    height: '42%',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  chipInnerRing: {
    width: '65%',
    height: '65%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  chipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  lockIcon: {
    fontSize: 9,
  },
  colorBlindShape: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
  },
  targetPulseBorder: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    left: 1,
    right: 1,
    borderWidth: 2,
    borderColor: palette.gold,
    borderRadius: 2,
    backgroundColor: 'rgba(245, 200, 76, 0.18)',
  },
  lastMoveRing: {
    borderColor: '#38BDF8',
    borderWidth: 2,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 8,
  },
  lockedCellGold: {
    borderColor: palette.gold,
    borderWidth: 1.5,
  },
  sequenceSweepCell: {
    backgroundColor: 'rgba(245, 200, 76, 0.25)',
    borderColor: palette.gold,
    borderWidth: 2,
  },
  shatterContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  shatterIcon: {
    fontSize: 18,
  },
});

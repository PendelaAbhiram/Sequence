// ─────────────────────────────────────────────────────────────────────────────
// TurnBanner – Sliding Animated Banner for Turn Changes
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  SlideInRight,
  SlideOutLeft,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { TeamId } from '../engine/types';
import { palette, radius, typography } from '../theme';

interface TurnBannerProps {
  playerName: string;
  teamId: TeamId;
  isBot: boolean;
  visible: boolean;
}

export const TurnBanner: React.FC<TurnBannerProps> = ({
  playerName,
  teamId,
  isBot,
  visible,
}) => {
  if (!visible) return null;

  const teamColor =
    teamId === 'red' ? palette.red : teamId === 'blue' ? palette.blue : palette.green;

  return (
    <Animated.View
      entering={SlideInRight.duration(280)}
      exiting={SlideOutLeft.duration(240)}
      style={styles.bannerContainer}
      pointerEvents="none"
    >
      <View style={[styles.bannerInner, { borderColor: teamColor }]}>
        <View style={[styles.chipIndicator, { backgroundColor: teamColor }]} />
        <Text style={styles.bannerText}>
          {isBot ? '🤖 ' : ''}
          <Text style={{ fontWeight: '900', color: '#FFFFFF' }}>{playerName}</Text>'s Turn
        </Text>
        <View style={[styles.teamMiniBadge, { backgroundColor: teamColor }]}>
          <Text style={styles.teamMiniText}>{teamId.toUpperCase()}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    zIndex: 9980,
  },
  bannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(9, 21, 33, 0.94)',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  chipIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bannerText: {
    ...typography.caption,
    fontSize: 12.5,
    color: '#E2E8F0',
  },
  teamMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  teamMiniText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

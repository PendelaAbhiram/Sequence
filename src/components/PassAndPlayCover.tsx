// ─────────────────────────────────────────────────────────────────────────────
// PassAndPlayCover – Privacy Shield for Friends Mode (Pass & Play)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { palette, radius, spacing, typography } from '../theme';
import { TeamId } from '../engine/types';

interface PassAndPlayCoverProps {
  visible: boolean;
  playerName: string;
  playerSeat: number;
  teamId: TeamId;
  onReveal: () => void;
}

export const PassAndPlayCover: React.FC<PassAndPlayCoverProps> = ({
  visible,
  playerName,
  playerSeat,
  teamId,
  onReveal,
}) => {
  if (!visible) return null;

  const teamColor =
    teamId === 'red' ? palette.red : teamId === 'blue' ? palette.blue : palette.green;

  const handleReveal = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onReveal();
  };

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={styles.overlay}
    >
      <Animated.View entering={ZoomIn.duration(300)} style={styles.cardContainer}>
        {/* Pass Device Icon */}
        <View style={styles.phoneIconCircle}>
          <Text style={styles.phoneIcon}>📱</Text>
        </View>

        <Text style={styles.passHeader}>PASS THE PHONE TO</Text>
        <Text style={styles.playerName}>{playerName}</Text>

        <View style={[styles.teamBadge, { borderColor: teamColor }]}>
          <View style={[styles.chipDot, { backgroundColor: teamColor }]} />
          <Text style={[styles.teamText, { color: teamColor }]}>
            Team {teamId.toUpperCase()} • Seat {playerSeat + 1}
          </Text>
        </View>

        <Text style={styles.privacyNote}>
          Your hand is hidden to keep your cards secret from opponents.
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleReveal}
          style={[styles.revealButton, { backgroundColor: teamColor }]}
          accessibilityLabel={`Reveal hand for ${playerName}`}
          accessibilityRole="button"
        >
          <Text style={styles.revealButtonText}>Tap to reveal my hand 👁️</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 11, 20, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: spacing.xl,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0E1E2E',
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  phoneIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneIcon: {
    fontSize: 32,
  },
  passHeader: {
    ...typography.caption,
    fontSize: 12,
    letterSpacing: 2,
    color: '#94A3B8',
    fontWeight: '800',
  },
  playerName: {
    ...typography.h2,
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teamText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  privacyNote: {
    ...typography.body,
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  revealButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  revealButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SequenceCelebration – "SEQUENCE!" Banner & 60fps Confetti Burst
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { TeamId } from '../engine/types';
import { palette, radius, typography } from '../theme';
import { soundManager } from '../utils/audio';

interface SequenceCelebrationProps {
  visible: boolean;
  teamId: TeamId;
  onDismiss: () => void;
}

// Generate random confetti particle descriptors
const CONFETTI_COUNT = 32;
const CONFETTI_COLORS = [
  palette.gold,
  palette.red,
  palette.blue,
  palette.green,
  '#38BDF8',
  '#F43F5E',
  '#A855F7',
];

interface ConfettiPieceProps {
  index: number;
}

const ConfettiPiece: React.FC<ConfettiPieceProps> = ({ index }) => {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const startX = (index / CONFETTI_COUNT) * 360 - 180;
  const targetX = startX + (Math.random() - 0.5) * 120;
  const targetY = (Math.random() - 0.5) * 400;
  const rotateDeg = Math.random() * 720 - 360;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 1800,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: targetX * p },
        { translateY: targetY * p + p * 80 }, // gravity
        { rotate: `${rotateDeg * p}deg` },
        { scale: (1 - p * 0.4) },
      ],
      opacity: 1 - p * 0.75,
    };
  });

  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          backgroundColor: color,
          width: index % 2 === 0 ? 10 : 8,
          height: index % 3 === 0 ? 14 : 8,
          borderRadius: index % 4 === 0 ? 5 : 2,
        },
        animatedStyle,
      ]}
    />
  );
};

export const SequenceCelebration: React.FC<SequenceCelebrationProps> = ({
  visible,
  teamId,
  onDismiss,
}) => {
  useEffect(() => {
    if (!visible) return;

    soundManager.playSequenceJingle();
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const timer = setTimeout(() => {
      onDismiss();
    }, 2400);

    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  const teamColor =
    teamId === 'red' ? palette.red : teamId === 'blue' ? palette.blue : palette.green;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(300)}
      style={styles.overlay}
      pointerEvents="none"
    >
      {/* Confetti Particles */}
      <View style={styles.confettiEmitter}>
        {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
      </View>

      {/* Celebration Banner Card */}
      <Animated.View
        entering={ZoomIn.duration(350).springify().damping(12)}
        style={[styles.bannerCard, { borderColor: teamColor }]}
      >
        <View style={styles.starRow}>
          <Text style={styles.star}>★</Text>
          <Text style={styles.star}>★</Text>
          <Text style={styles.star}>★</Text>
        </View>

        <Text style={styles.bannerTitle}>SEQUENCE!</Text>

        <View style={[styles.teamTag, { backgroundColor: teamColor }]}>
          <Text style={styles.teamTagText}>
            TEAM {teamId.toUpperCase()} SCORED A SEQUENCE!
          </Text>
        </View>

        <Text style={styles.lockedNote}>
          5 chips locked permanently in gold
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 9990,
  },
  confettiEmitter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confetti: {
    position: 'absolute',
  },
  bannerCard: {
    backgroundColor: '#0A1826',
    borderWidth: 3,
    borderRadius: radius.xl,
    paddingHorizontal: 28,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 24,
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
  },
  star: {
    fontSize: 20,
    color: palette.gold,
  },
  bannerTitle: {
    ...typography.h1,
    fontSize: 32,
    fontWeight: '900',
    color: palette.gold,
    letterSpacing: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  teamTag: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginTop: 2,
  },
  teamTagText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  lockedNote: {
    ...typography.caption,
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
    marginTop: 2,
  },
});

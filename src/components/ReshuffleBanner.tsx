// ─────────────────────────────────────────────────────────────────────────────
// ReshuffleBanner – Draw-Pile Reshuffle Animation Banner
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { palette, radius, spacing, typography } from '../theme';
import { soundManager } from '../utils/audio';

interface ReshuffleBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

export const ReshuffleBanner: React.FC<ReshuffleBannerProps> = ({
  visible,
  onDismiss,
}) => {
  useEffect(() => {
    if (!visible) return;

    soundManager.playCardShuffle();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const timer = setTimeout(() => {
      onDismiss();
    }, 2200);

    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(250)}
      style={styles.overlay}
      pointerEvents="none"
    >
      <Animated.View entering={ZoomIn.duration(300)} style={styles.cardContainer}>
        <Text style={styles.icon}>🂠 🔄 🂠</Text>
        <Text style={styles.title}>DRAW PILE REPLENISHED</Text>
        <Text style={styles.subtext}>
          All player discard piles have been gathered and reshuffled into a fresh draw deck!
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
    backgroundColor: 'rgba(5, 12, 22, 0.7)',
    zIndex: 9985,
  },
  cardContainer: {
    backgroundColor: '#0E1F30',
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: palette.gold,
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: 'center',
    maxWidth: 320,
    gap: 6,
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
  },
  icon: {
    fontSize: 26,
    color: palette.gold,
    letterSpacing: 4,
  },
  title: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '900',
    color: palette.gold,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtext: {
    ...typography.body,
    fontSize: 12,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 16,
  },
});

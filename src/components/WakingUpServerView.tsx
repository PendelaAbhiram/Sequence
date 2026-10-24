// ─────────────────────────────────────────────────────────────────────────────
// Sequence – "Waking Up the Server" View
// Displayed when the first connection to Render free tier takes > 5 seconds.
// Features animated status pulse, live elapsed counter, tips, and manual retry.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { GlassPanel } from './GlassPanel';
import { PrimaryButton } from './PrimaryButton';
import { palette, radius, spacing, typography } from '../theme';

export interface WakingUpServerViewProps {
  elapsedSeconds?: number;
  onRetry: () => void;
  onCancel?: () => void;
}

export const WakingUpServerView: React.FC<WakingUpServerViewProps> = ({
  elapsedSeconds = 5,
  onRetry,
  onCancel,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const [seconds, setSeconds] = useState(elapsedSeconds);

  useEffect(() => {
    setSeconds(elapsedSeconds);
  }, [elapsedSeconds]);

  // Track elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ambient pulsing glow animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.9,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, glowAnim]);

  const handleRetryPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setSeconds(0);
    onRetry();
  };

  const getStatusMessage = (sec: number) => {
    if (sec < 10) return '🚀 Initializing free cloud container on Render...';
    if (sec < 25) return '⚡ Booting Node.js runtime & game room manager...';
    if (sec < 45) return '🌐 Establishing secure Socket.io WebSocket link...';
    return '⏳ Almost ready! Container is warming up...';
  };

  return (
    <View style={styles.container}>
      <GlassPanel style={styles.card}>
        {/* Animated Beacon Icon */}
        <View style={styles.iconWrapper}>
          <Animated.View
            style={[
              styles.glowHalo,
              {
                opacity: glowAnim,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.iconCircle,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Text style={styles.beaconEmoji}>☁️</Text>
          </Animated.View>
        </View>

        {/* Title & Tag */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>RENDER FREE TIER</Text>
        </View>
        <Text style={styles.title}>Waking up the server...</Text>

        {/* Explanation */}
        <Text style={styles.description}>
          The cloud server sleeps when idle to conserve resources. It is spinning up now — this
          typically takes 20 to 50 seconds on cold start.
        </Text>

        {/* Live Elapsed & Spinner */}
        <View style={styles.progressRow}>
          <ActivityIndicator size="small" color={palette.gold} />
          <Text style={styles.elapsedText}>
            Elapsed: <Text style={styles.elapsedBold}>{seconds}s</Text>
          </Text>
        </View>

        {/* Dynamic Status Message */}
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{getStatusMessage(seconds)}</Text>
        </View>

        {/* Retry Button */}
        <View style={styles.actions}>
          <PrimaryButton
            title="Retry Connection"
            onPress={handleRetryPress}
            style={styles.retryBtn}
          />

          {onCancel && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onCancel}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>Back to Home</Text>
            </TouchableOpacity>
          )}
        </View>
      </GlassPanel>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1.5,

    borderColor: 'rgba(245, 200, 76, 0.35)',
  },
  iconWrapper: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  glowHalo: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(245, 200, 76, 0.22)',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(7, 22, 36, 0.85)',
    borderWidth: 2,
    borderColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  beaconEmoji: {
    fontSize: 32,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245, 200, 76, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 76, 0.4)',
    marginBottom: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: palette.gold,
    letterSpacing: 1,
  },
  title: {
    ...typography.title,
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  elapsedText: {
    ...typography.caption,
    fontSize: 13,
    color: '#CBD5E1',
  },
  elapsedBold: {
    fontWeight: '800',
    color: palette.gold,
  },
  statusBox: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  statusText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  retryBtn: {
    width: '100%',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
});

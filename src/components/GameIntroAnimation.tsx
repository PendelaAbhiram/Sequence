// ─────────────────────────────────────────────────────────────────────────────
// GameIntroAnimation – "Cut the Deck" Dealer Reveal & Card Deal Animation
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Card, Suit } from '../engine/types';
import { PlayerState } from '../engine/gameReducer';
import { palette, radius, spacing, typography } from '../theme';
import { soundManager } from '../utils/audio';

interface GameIntroAnimationProps {
  visible: boolean;
  players: PlayerState[];
  dealerIndex: number;
  cutCards?: Card[];
  onComplete: () => void;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  spades: '#0F172A',
  clubs: '#334155',
  hearts: '#E5484D',
  diamonds: '#EA580C',
};

export const GameIntroAnimation: React.FC<GameIntroAnimationProps> = ({
  visible,
  players,
  dealerIndex,
  cutCards = [],
  onComplete,
}) => {
  const [phase, setPhase] = useState<'cut' | 'deal' | 'ready'>('cut');

  useEffect(() => {
    if (!visible) return;

    soundManager.playCardShuffle();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    // Phase 1: Cut the deck reveal (2.2s)
    const t1 = setTimeout(() => {
      setPhase('deal');
      soundManager.playCardShuffle();
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }, 2400);

    // Phase 2: Deal cards animation (2.0s) -> complete
    const t2 = setTimeout(() => {
      onComplete();
    }, 4200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible, onComplete]);

  if (!visible) return null;

  const dealer = players[dealerIndex] ?? players[0];
  const startingPlayerIndex = (dealerIndex + 1) % players.length;
  const startingPlayer = players[startingPlayerIndex] ?? players[0];

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(250)}
      style={styles.overlay}
    >
      <View style={styles.contentContainer}>
        {/* Skip button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onComplete}
          style={styles.skipButton}
          accessibilityLabel="Skip intro animation"
        >
          <Text style={styles.skipButtonText}>SKIP ❯❯</Text>
        </TouchableOpacity>

        {phase === 'cut' ? (
          <Animated.View entering={ZoomIn.duration(300)} style={styles.cutDeckBox}>
            <Text style={styles.titleBadge}>CUT THE DECK</Text>
            <Text style={styles.instructionText}>
              Lowest card deals • Player to dealer's left starts
            </Text>

            {/* Row of cut cards */}
            <View style={styles.cutCardsRow}>
              {players.map((p, idx) => {
                const card = cutCards[idx];
                const isDealer = idx === dealerIndex;
                const teamColor =
                  p.teamId === 'red'
                    ? palette.red
                    : p.teamId === 'blue'
                    ? palette.blue
                    : palette.green;

                return (
                  <Animated.View
                    key={p.id}
                    entering={SlideInUp.delay(idx * 150)}
                    style={[
                      styles.cutCardItem,
                      isDealer && styles.dealerCutCardHighlight,
                    ]}
                  >
                    <View style={styles.cutCardBody}>
                      {card ? (
                        <>
                          <Text
                            style={[
                              styles.cutCardRank,
                              { color: SUIT_COLORS[card.suit] },
                            ]}
                          >
                            {card.rank}
                          </Text>
                          <Text
                            style={[
                              styles.cutCardSuit,
                              { color: SUIT_COLORS[card.suit] },
                            ]}
                          >
                            {SUIT_SYMBOLS[card.suit]}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.cutCardBack}>🂠</Text>
                      )}
                    </View>
                    <Text style={styles.playerNameText} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {isDealer && (
                      <View style={[styles.dealerTag, { backgroundColor: teamColor }]}>
                        <Text style={styles.dealerTagText}>DEALER</Text>
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </View>

            <View style={styles.cutVerdictBox}>
              <Text style={styles.verdictText}>
                👑 <Text style={{ color: palette.gold, fontWeight: '900' }}>{dealer.name}</Text> deals!{' '}
                <Text style={{ color: '#38BDF8', fontWeight: '800' }}>{startingPlayer.name}</Text> plays first!
              </Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(250)} style={styles.dealContainer}>
            <Text style={styles.titleBadge}>DEALING HANDS</Text>
            <View style={styles.deckStack}>
              {[0, 1, 2, 3].map((offset) => (
                <View
                  key={offset}
                  style={[
                    styles.stackedCard,
                    {
                      transform: [
                        { translateY: -offset * 3 },
                        { rotate: `${(offset - 1.5) * 4}deg` },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.stackPattern}>🂠</Text>
                </View>
              ))}
            </View>
            <Text style={styles.dealingSubtext}>
              Distributing cards clockwise from {dealer.name}...
            </Text>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(4, 10, 18, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9998,
    padding: spacing.lg,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  skipButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.gold,
    letterSpacing: 1,
  },
  cutDeckBox: {
    width: '100%',
    backgroundColor: '#0F2132',
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 12,
  },
  titleBadge: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '900',
    color: palette.gold,
    letterSpacing: 2,
  },
  instructionText: {
    ...typography.caption,
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 12,
  },
  cutCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  cutCardItem: {
    alignItems: 'center',
    width: 64,
  },
  dealerCutCardHighlight: {
    transform: [{ scale: 1.08 }],
  },
  cutCardBody: {
    width: 52,
    height: 72,
    borderRadius: radius.xs,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  cutCardRank: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  cutCardSuit: {
    fontSize: 18,
    fontWeight: '900',
  },
  cutCardBack: {
    fontSize: 28,
    color: '#3B82F6',
  },
  playerNameText: {
    ...typography.caption,
    fontSize: 11,
    color: '#E2E8F0',
    marginTop: 4,
    fontWeight: '700',
  },
  dealerTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  dealerTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cutVerdictBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: spacing.xs,
  },
  verdictText: {
    ...typography.body,
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
  },
  dealContainer: {
    width: '100%',
    backgroundColor: '#0F2132',
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  deckStack: {
    width: 60,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  stackedCard: {
    position: 'absolute',
    width: 56,
    height: 80,
    borderRadius: radius.xs,
    backgroundColor: '#1E3A8A',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  stackPattern: {
    fontSize: 28,
    color: '#93C5FD',
  },
  dealingSubtext: {
    ...typography.body,
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
  },
});

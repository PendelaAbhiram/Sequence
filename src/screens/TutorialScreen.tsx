// ─────────────────────────────────────────────────────────────────────────────
// Sequence – 4-Slide Interactive Tutorial & Official Rules Screen
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ScreenBackground, GlassPanel, PrimaryButton, ScreenHeader } from '../components';
import { palette, radius, spacing, typography } from '../theme';
import { ScreenProps } from './types';

export const TutorialScreen: React.FC<ScreenProps<'Tutorial'> | ScreenProps<'Rules'>> = ({ route, navigation }) => {
  const initialTab = (route?.params as any)?.initialTab || 'tutorial';
  const [tab, setTab] = useState<'tutorial' | 'rules'>(initialTab);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const onBackPress = () => {
      navigation.navigate('Home');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  const handleSkip = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    navigation.navigate('Home');
  };

  // 4 Interactive Slides
  const slides = [
    {
      title: '1. Place Your Chips',
      subtitle: 'Match your hand card to the board',
      badge: 'BASICS',
      icon: '🃏 ➔ 🔵',
      description:
        'Every standard playing card in your hand appears exactly twice on the 10×10 board. Tap a card in your hand to highlight its matching board locations, then tap a highlighted space to drop your team\'s chip!',
      tip: 'Pro Tip: Control center cells early for more diagonal and cross-sequence threats.',
      demo: (
        <View style={styles.demoBox}>
          <View style={styles.miniCardDemo}>
            <Text style={styles.miniCardDemoText}>7 ♥</Text>
          </View>
          <Text style={styles.demoArrow}>➔</Text>
          <View style={styles.miniCellHighlight}>
            <Text style={styles.miniCellText}>7 ♥</Text>
            <View style={styles.demoChipCircle} />
          </View>
        </View>
      ),
    },
    {
      title: '2. Make 5 in a Row',
      subtitle: 'Horizontal, vertical, or diagonal',
      badge: 'SEQUENCE',
      icon: '🔴🔴🔴🔴🔴',
      description:
        'A Sequence is an unbroken line of 5 chips of your team\'s color. Lines can run horizontally, vertically, or diagonally. In 2-team games, you need 2 sequences to win. In 3-team games, 1 sequence wins!',
      tip: 'Shared-Chip Rule: Two sequences of the same team may share at most 1 common chip.',
      demo: (
        <View style={styles.demoRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.demoRowChip, { backgroundColor: palette.red }]}>
              <Text style={styles.demoRowChipText}>●</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      title: '3. Two-Eyed & One-Eyed Jacks',
      subtitle: 'Special game-changing powers',
      badge: 'JACKS',
      icon: '👁️👁️ vs 👁️',
      description:
        'Two-Eyed Jacks (Diamonds ♦ & Clubs ♣) are WILD: place a chip on any unoccupied space!\n\nOne-Eyed Jacks (Spades ♠ & Hearts ♥) are REMOVERS: remove any opponent chip from the board!',
      tip: 'Crucial: One-eyed Jacks CANNOT remove chips from already completed, locked sequences.',
      demo: (
        <View style={styles.demoJacksRow}>
          <View style={styles.jackBadgeBox}>
            <Text style={styles.jackTitle}>TWO-EYED (♦/♣)</Text>
            <Text style={styles.jackDesc}>WILD: Place Anywhere</Text>
          </View>
          <View style={[styles.jackBadgeBox, { borderColor: '#EF4444' }]}>
            <Text style={[styles.jackTitle, { color: '#EF4444' }]}>ONE-EYED (♠/♥)</Text>
            <Text style={styles.jackDesc}>REMOVE: Clear Opponent</Text>
          </View>
        </View>
      ),
    },
    {
      title: '4. Free Corners & Dead Cards',
      subtitle: 'Bonus corners & auto-replacement',
      badge: 'SPECIAL',
      icon: '★ ➔ 🔄',
      description:
        'The 4 corners of the board are FREE neutral spaces that count for EVERY team! Only 4 chips are needed to complete a sequence using a corner.\n\nIf both spaces for a card in your hand are already covered, that card is DEAD. Tap "Discard & Draw" to draw a fresh card!',
      tip: 'Corners are never locked and can be shared by multiple sequences and teams.',
      demo: (
        <View style={styles.demoCornersBox}>
          <View style={styles.cornerMiniCell}>
            <Text style={styles.cornerStarText}>★</Text>
            <Text style={styles.cornerTagText}>FREE</Text>
          </View>
          <Text style={styles.demoPlus}>+</Text>
          <View style={styles.demoRow}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.demoRowChip, { backgroundColor: palette.blue }]}>
                <Text style={styles.demoRowChipText}>●</Text>
              </View>
            ))}
          </View>
          <Text style={styles.demoEquals}>= 🏆</Text>
        </View>
      ),
    },
  ];

  const handleNext = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigation.navigate('Home');
    }
  };

  const handlePrev = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const slide = slides[currentSlide];

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header with Consistent Back & Skip Action */}
        <ScreenHeader
          title="HOW TO PLAY"
          subtitle={tab === 'tutorial' ? '4-Slide Interactive Tutorial' : 'Official Sequence Rules'}
          onBack={() => navigation.navigate('Home')}
          rightAction={
            <TouchableOpacity
              onPress={handleSkip}
              activeOpacity={0.7}
              style={styles.skipBtn}
              accessibilityRole="button"
              accessibilityLabel="Skip to home"
            >
              <Text style={styles.skipBtnText}>Skip ✕</Text>
            </TouchableOpacity>
          }
        />

        <View style={styles.headerTabsWrapper}>
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setTab('tutorial')}
              style={[styles.segmentBtn, tab === 'tutorial' && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, tab === 'tutorial' && styles.segmentTextActive]}>
                Interactive Tutorial
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setTab('rules')}
              style={[styles.segmentBtn, tab === 'rules' && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, tab === 'rules' && styles.segmentTextActive]}>
                Official Rules
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {tab === 'tutorial' ? (
          <View style={styles.tutorialContainer}>
            {/* Step Counter Indicator */}
            <View style={styles.stepProgressRow}>
              {slides.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.stepPill,
                    idx === currentSlide && styles.stepPillActive,
                    idx < currentSlide && styles.stepPillCompleted,
                  ]}
                />
              ))}
            </View>

            {/* Interactive Slide Card */}
            <Animated.View
              key={currentSlide}
              entering={SlideInRight.duration(280)}
              exiting={SlideOutLeft.duration(220)}
              style={styles.slideCardWrapper}
            >
              <GlassPanel style={styles.slideCard}>
                <View style={styles.badgeRow}>
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>{slide.badge}</Text>
                  </View>
                  <Text style={styles.slideCounter}>
                    STEP {currentSlide + 1} OF 4
                  </Text>
                </View>

                <Text style={styles.slideTitle}>{slide.title}</Text>
                <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>

                {/* Visual Demo Demonstration */}
                {slide.demo}

                <Text style={styles.slideDesc}>{slide.description}</Text>

                <View style={styles.tipBox}>
                  <Text style={styles.tipText}>💡 {slide.tip}</Text>
                </View>
              </GlassPanel>
            </Animated.View>

            {/* Navigation Buttons */}
            <View style={styles.navRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handlePrev}
                disabled={currentSlide === 0}
                style={[styles.prevButton, currentSlide === 0 && styles.prevButtonDisabled]}
              >
                <Text style={styles.prevButtonText}>❮ Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleNext}
                style={styles.nextButton}
              >
                <Text style={styles.nextButtonText}>
                  {currentSlide === slides.length - 1 ? 'Done & Home ❯' : 'Next ❯'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.rulesContainer}>
            <GlassPanel style={styles.rulesCard}>
              <Text style={styles.rulesCardHeader}>1. PLAYERS & TEAMS</Text>
              <Text style={styles.rulesBody}>
                • Allowed player counts: 2, 3, 4, 6, 8, 9, 10, or 12 players.{'\n'}
                • 2 Teams: Red & Blue (need 2 Sequences to win).{'\n'}
                • 3 Teams: Red, Blue & Green (need 1 Sequence to win).{'\n'}
                • Teammates are seated alternately around the board so turns rotate evenly.
              </Text>

              <Text style={styles.rulesCardHeader}>2. HAND SIZES</Text>
              <View style={styles.tableBox}>
                <Text style={styles.tableRow}>• 2 players: 7 cards each</Text>
                <Text style={styles.tableRow}>• 3 or 4 players: 6 cards each</Text>
                <Text style={styles.tableRow}>• 6 players: 5 cards each</Text>
                <Text style={styles.tableRow}>• 8 or 9 players: 4 cards each</Text>
                <Text style={styles.tableRow}>• 10 or 12 players: 3 cards each</Text>
              </View>

              <Text style={styles.rulesCardHeader}>3. CUT THE DECK & DEALER</Text>
              <Text style={styles.rulesBody}>
                Before play starts, each player cuts a card from the deck. The lowest card deals. The player to the dealer's left plays first.
              </Text>

              <Text style={styles.rulesCardHeader}>4. DEAD CARDS</Text>
              <Text style={styles.rulesBody}>
                If both spaces for a card on the board are already occupied by chips, you may announce it as a DEAD CARD, discard it to your personal discard pile, and draw a replacement before making your play.
              </Text>

              <Text style={styles.rulesCardHeader}>5. WINNING THE MATCH</Text>
              <Text style={styles.rulesBody}>
                The first team to score the required number of completed sequences wins the game immediately. Completed sequence chips lock permanently in gold!
              </Text>
            </GlassPanel>

            <PrimaryButton
              title="Done (Return to Home)"
              variant="gold"
              onPress={() => navigation.navigate('Home')}
            />
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTabsWrapper: {
    width: '100%',
    maxWidth: 420,
    marginBottom: spacing.xs,
  },
  skipBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  skipBtnText: {
    ...typography.caption,
    color: palette.gold,
    fontWeight: '800',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    width: '100%',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  segmentBtnActive: {
    backgroundColor: palette.gold,
  },
  segmentText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  segmentTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  tutorialContainer: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
  },
  stepProgressRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  stepPill: {
    width: 24,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  stepPillActive: {
    backgroundColor: palette.gold,
    width: 38,
  },
  stepPillCompleted: {
    backgroundColor: '#38BDF8',
  },
  slideCardWrapper: {
    width: '100%',
  },
  slideCard: {
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: 'rgba(12, 24, 40, 0.85)',
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245, 200, 76, 0.15)',
    borderWidth: 1,
    borderColor: palette.gold,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.gold,
    letterSpacing: 1,
  },
  slideCounter: {
    ...typography.caption,
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  slideTitle: {
    ...typography.h2,
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  slideSubtitle: {
    ...typography.caption,
    fontSize: 13,
    color: palette.gold,
    fontWeight: '700',
  },
  slideDesc: {
    ...typography.body,
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  tipBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginTop: 4,
  },
  tipText: {
    ...typography.caption,
    color: '#BAE6FD',
    fontSize: 12,
    lineHeight: 16,
  },
  demoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: spacing.sm,
  },
  miniCardDemo: {
    width: 44,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  miniCardDemoText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#E5484D',
  },
  demoArrow: {
    fontSize: 18,
    color: palette.gold,
    fontWeight: '800',
  },
  miniCellHighlight: {
    width: 44,
    height: 60,
    backgroundColor: 'rgba(245, 200, 76, 0.25)',
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  miniCellText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  demoChipCircle: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.blue,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  demoRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  demoRowChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  demoRowChipText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  demoJacksRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: spacing.xs,
  },
  jackBadgeBox: {
    flex: 1,
    padding: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: palette.gold,
    alignItems: 'center',
  },
  jackTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.gold,
    letterSpacing: 0.5,
  },
  jackDesc: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
    textAlign: 'center',
  },
  demoCornersBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  cornerMiniCell: {
    width: 32,
    height: 32,
    backgroundColor: '#073324',
    borderWidth: 1.5,
    borderColor: palette.gold,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerStarText: {
    color: palette.gold,
    fontSize: 14,
    fontWeight: '900',
  },
  cornerTagText: {
    color: palette.gold,
    fontSize: 7,
    fontWeight: '800',
  },
  demoPlus: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  demoEquals: {
    fontSize: 16,
    marginLeft: 4,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  prevButton: {
    flex: 1,
    height: 50,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevButtonDisabled: {
    opacity: 0.3,
  },
  prevButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nextButton: {
    flex: 2,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  rulesContainer: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
  },
  rulesCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  rulesCardHeader: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '900',
    color: palette.gold,
    letterSpacing: 1.5,
    marginTop: spacing.xs,
  },
  rulesBody: {
    ...typography.body,
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 19,
  },
  tableBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tableRow: {
    ...typography.caption,
    fontSize: 12,
    color: '#F8FAFC',
  },
});

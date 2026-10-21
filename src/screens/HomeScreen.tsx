// ─────────────────────────────────────────────────────────────────────────────
// Sequence – Home Screen (Premium Design with Animated Logo & Large Cards)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ScreenBackground, GlassPanel, PrimaryButton } from '../components';
import { palette, radius, spacing, typography } from '../theme';
import { ScreenProps } from './types';
import { useGameStore } from '../store/gameStore';
import { useOnlineStore } from '../store/onlineStore';

export const HomeScreen: React.FC<ScreenProps<'Home'>> = ({ navigation }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const chipFloatAnim = useRef(new Animated.Value(0)).current;
  const hasSavedGame = useGameStore((s) => s.hasSavedGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const checkSavedGame = useGameStore((s) => s.checkSavedGame);

  const createRoom = useOnlineStore((s) => s.createRoom);
  const joinRoom = useOnlineStore((s) => s.joinRoom);

  const [onlineModalVisible, setOnlineModalVisible] = useState(false);
  const [onlineTab, setOnlineTab] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState('Player');
  const [joinCode, setJoinCode] = useState('');
  const [teamCount, setTeamCount] = useState<2 | 3>(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  useEffect(() => {
    checkSavedGame();

    // Gentle logo breathing pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Floating chip row
    const chipFloat = Animated.loop(
      Animated.sequence([
        Animated.timing(chipFloatAnim, {
          toValue: -6,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(chipFloatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    chipFloat.start();

    return () => {
      pulse.stop();
      chipFloat.stop();
    };
  }, [pulseAnim, chipFloatAnim, checkSavedGame]);

  const handleCardPress = (route: 'BotSetup' | 'PlayerSetup') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    navigation.navigate(route);
  };

  const handleResume = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const success = await resumeGame();
    if (success) {
      navigation.navigate('Game');
    }
  };

  const handleOpenOnline = (tab: 'create' | 'join' = 'create') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setOnlineTab(tab);
    setOnlineError(null);
    setOnlineModalVisible(true);
  };

  const handleCreateRoom = async () => {
    if (isSubmitting) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setIsSubmitting(true);
    setOnlineError(null);

    const result = await createRoom(playerName, { teamCount });
    setIsSubmitting(false);

    if (result.success) {
      setOnlineModalVisible(false);
      navigation.navigate('Lobby');
    } else {
      setOnlineError(result.error || 'Failed to create room.');
    }
  };

  const handleJoinRoom = async () => {
    if (isSubmitting) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setOnlineError('Room code must be exactly 6 characters.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setIsSubmitting(true);
    setOnlineError(null);

    const result = await joinRoom(code, playerName);
    setIsSubmitting(false);

    if (result.success) {
      setOnlineModalVisible(false);
      setJoinCode('');
      navigation.navigate('Lobby');
    } else {
      setOnlineError(result.error || `Could not join room ${code}.`);
    }
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated Brand Logo */}
        <View style={styles.heroSection}>
          <Animated.View style={[styles.logoBadgeContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.crownContainer}>
              <Text style={styles.crownIcon}>👑</Text>
            </View>
            <Text style={styles.logoSubtext}>THE BOARD GAME OF STRATEGY</Text>
            <Text style={styles.logoTitle}>SEQUENCE</Text>
          </Animated.View>

          {/* Floating Chip Badges */}
          <Animated.View
            style={[
              styles.chipsContainer,
              { transform: [{ translateY: chipFloatAnim }] },
            ]}
          >
            <View style={[styles.pokerChip, { backgroundColor: palette.red }]}>
              <Text style={styles.chipLetter}>R</Text>
            </View>
            <View style={[styles.pokerChip, { backgroundColor: palette.blue }]}>
              <Text style={styles.chipLetter}>B</Text>
            </View>
            <View style={[styles.pokerChip, { backgroundColor: palette.green }]}>
              <Text style={styles.chipLetter}>G</Text>
            </View>
            <View style={[styles.pokerChip, { backgroundColor: palette.gold }]}>
              <Text style={[styles.chipLetter, { color: '#0F172A' }]}>★</Text>
            </View>
          </Animated.View>
        </View>

        {/* Resume Game Banner if game in progress */}
        {hasSavedGame && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleResume}
            style={styles.resumeCard}
          >
            <View style={styles.resumeContent}>
              <Text style={styles.resumeIcon}>▶️</Text>
              <View>
                <Text style={styles.resumeTitle}>Resume Saved Match</Text>
                <Text style={styles.resumeSubtitle}>Pick up right where you left off</Text>
              </View>
            </View>
            <Text style={styles.resumeArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Two Large Game Mode Cards */}
        <View style={styles.modesContainer}>
          {/* Card 1: Play vs Computer */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleCardPress('BotSetup')}
            style={styles.largeCardTouchable}
          >
            <GlassPanel style={styles.largeCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(62, 99, 221, 0.25)', borderColor: palette.blue }]}>
                  <Text style={styles.cardIcon}>🤖</Text>
                </View>
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>SOLO / BOT</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Play vs Computer</Text>
                <Text style={styles.cardDescription}>
                  Face intelligent AI opponents across Easy, Medium, and Hard difficulty tiers.
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>2 or 3 Teams • Smart AI</Text>
                <Text style={styles.cardArrow}>→</Text>
              </View>
            </GlassPanel>
          </TouchableOpacity>

          {/* Card 2: Play with Friends */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleCardPress('PlayerSetup')}
            style={styles.largeCardTouchable}
          >
            <GlassPanel style={styles.largeCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 200, 76, 0.22)', borderColor: palette.gold }]}>
                  <Text style={styles.cardIcon}>👥</Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: 'rgba(245, 200, 76, 0.18)', borderColor: palette.gold }]}>
                  <Text style={[styles.badgeText, { color: palette.gold }]}>PASS & PLAY</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Play with Friends</Text>
                <Text style={styles.cardDescription}>
                  Gather 2 to 12 players around one phone. Alternate seating and live team assignments.
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>2 to 12 Players • One Phone</Text>
                <Text style={styles.cardArrow}>→</Text>
              </View>
            </GlassPanel>
          </TouchableOpacity>

          {/* Card 3: Play Online */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleOpenOnline('create')}
            style={styles.largeCardTouchable}
          >
            <GlassPanel style={styles.largeCard}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: 'rgba(34, 197, 94, 0.22)',
                      borderColor: '#22C55E',
                    },
                  ]}
                >
                  <Text style={styles.cardIcon}>🌐</Text>
                </View>
                <View
                  style={[
                    styles.badgePill,
                    {
                      backgroundColor: 'rgba(34, 197, 94, 0.18)',
                      borderColor: '#22C55E',
                    },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: '#86EFAC' }]}>
                    ONLINE MULTIPLAYER
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Play Online</Text>
                <Text style={styles.cardDescription}>
                  Host or join a real-time room with code. Play with friends across devices anywhere.
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>Create or Join Room • 2 or 3 Teams</Text>
                <Text style={styles.cardArrow}>→</Text>
              </View>
            </GlassPanel>
          </TouchableOpacity>
        </View>

        {/* Online Multiplayer Modal */}
        <Modal
          visible={onlineModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setOnlineModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalBackdrop}>
              <GlassPanel style={styles.modalContent}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Play Online</Text>
                    <Text style={styles.modalSubtitle}>
                      Real-time cross-device multiplayer
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setOnlineModalVisible(false)}
                    style={styles.closeModalBtn}
                  >
                    <Text style={styles.closeModalText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Tab Switcher: Create vs Join */}
                <View style={styles.modalTabRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.modalTabBtn,
                      onlineTab === 'create' && styles.modalTabBtnActive,
                    ]}
                    onPress={() => {
                      setOnlineTab('create');
                      setOnlineError(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalTabText,
                        onlineTab === 'create' && styles.modalTabTextActive,
                      ]}
                    >
                      Create Room
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.modalTabBtn,
                      onlineTab === 'join' && styles.modalTabBtnActive,
                    ]}
                    onPress={() => {
                      setOnlineTab('join');
                      setOnlineError(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalTabText,
                        onlineTab === 'join' && styles.modalTabTextActive,
                      ]}
                    >
                      Join Room
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Error Banner */}
                {onlineError && (
                  <View style={styles.modalErrorBox}>
                    <Text style={styles.modalErrorText}>{onlineError}</Text>
                  </View>
                )}

                {/* Player Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>YOUR NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={playerName}
                    onChangeText={setPlayerName}
                    placeholder="Enter your name"
                    placeholderTextColor="#64748B"
                    maxLength={16}
                    autoCapitalize="words"
                    returnKeyType="done"
                  />
                </View>

                {onlineTab === 'create' ? (
                  /* Create Room Options */
                  <View style={styles.tabSection}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>TEAMS COUNT</Text>
                      <View style={styles.teamSelectRow}>
                        <TouchableOpacity
                          style={[
                            styles.teamSelectBtn,
                            teamCount === 2 && styles.teamSelectBtnActive,
                          ]}
                          onPress={() => setTeamCount(2)}
                        >
                          <Text
                            style={[
                              styles.teamSelectText,
                              teamCount === 2 && styles.teamSelectTextActive,
                            ]}
                          >
                            2 Teams (Red vs Blue)
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.teamSelectBtn,
                            teamCount === 3 && styles.teamSelectBtnActive,
                          ]}
                          onPress={() => setTeamCount(3)}
                        >
                          <Text
                            style={[
                              styles.teamSelectText,
                              teamCount === 3 && styles.teamSelectTextActive,
                            ]}
                          >
                            3 Teams (+ Green)
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <PrimaryButton
                      title={isSubmitting ? 'Creating Room...' : 'Create Room'}
                      variant="gold"
                      onPress={handleCreateRoom}
                      disabled={isSubmitting || !playerName.trim()}
                    />
                  </View>
                ) : (
                  /* Join Room Options */
                  <View style={styles.tabSection}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>ROOM CODE (6 CHARS)</Text>
                      <TextInput
                        style={[styles.textInput, styles.codeInput]}
                        value={joinCode}
                        onChangeText={(text) =>
                          setJoinCode(text.toUpperCase().slice(0, 6))
                        }
                        placeholder="ENTER CODE"
                        placeholderTextColor="#64748B"
                        maxLength={6}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="go"
                        onSubmitEditing={handleJoinRoom}
                      />
                    </View>

                    <PrimaryButton
                      title={isSubmitting ? 'Joining Room...' : 'Join Room'}
                      variant="gold"
                      onPress={handleJoinRoom}
                      disabled={
                        isSubmitting ||
                        !playerName.trim() ||
                        joinCode.trim().length !== 6
                      }
                    />
                  </View>
                )}
              </GlassPanel>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Secondary Navigation Row: How to Play & Settings */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Tutorial')}
          >
            <Text style={styles.secondaryButtonText}>📖  How to Play</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.secondaryButtonText}>⚙️  Settings</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionTag}>Sequence Mobile • Casino Edition</Text>
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
    gap: spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  crownContainer: {
    marginBottom: spacing.xxs,
  },
  crownIcon: {
    fontSize: 28,
  },
  logoBadgeContainer: {
    alignItems: 'center',
  },
  logoSubtext: {
    ...typography.caption,
    color: palette.gold,
    letterSpacing: 3,
    marginBottom: 4,
  },
  logoTitle: {
    ...typography.h1,
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pokerChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  chipLetter: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  resumeCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(245, 200, 76, 0.15)',
    borderWidth: 1.5,
    borderColor: palette.gold,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  resumeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resumeIcon: {
    fontSize: 22,
  },
  resumeTitle: {
    ...typography.subtitle,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resumeSubtitle: {
    ...typography.caption,
    color: '#CBD5E1',
  },
  resumeArrow: {
    fontSize: 20,
    color: palette.gold,
    fontWeight: '800',
  },
  modesContainer: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
  },
  largeCardTouchable: {
    width: '100%',
    minHeight: 120,
  },
  largeCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(12, 24, 40, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 24,
  },
  badgePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(62, 99, 221, 0.2)',
    borderWidth: 1,
    borderColor: palette.blue,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '800',
    color: '#93C5FD',
    letterSpacing: 1,
  },
  cardBody: {
    gap: spacing.xxs,
  },
  cardTitle: {
    ...typography.h3,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardDescription: {
    ...typography.body,
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardFooterText: {
    ...typography.caption,
    color: palette.gold,
    fontWeight: '700',
  },
  cardArrow: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryActions: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.subtitle,
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  versionTag: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.35)',
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalBackdrop: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    gap: spacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 200, 76, 0.35)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    ...typography.h3,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalSubtitle: {
    ...typography.caption,
    color: '#94A3B8',
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalTabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  modalTabBtnActive: {
    backgroundColor: 'rgba(245, 200, 76, 0.25)',
  },
  modalTabText: {
    ...typography.caption,
    color: '#94A3B8',
    fontWeight: '700',
  },
  modalTabTextActive: {
    color: palette.gold,
    fontWeight: '900',
  },
  modalErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.xs,
  },
  modalErrorText: {
    ...typography.caption,
    fontSize: 12,
    color: '#FCA5A5',
    textAlign: 'center',
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    ...typography.caption,
    fontSize: 11,
    color: palette.gold,
    fontWeight: '800',
    letterSpacing: 1,
  },
  textInput: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.md,
    color: '#FFFFFF',
    fontSize: 15,
  },
  codeInput: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  tabSection: {
    gap: spacing.md,
  },
  teamSelectRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  teamSelectBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
  },
  teamSelectBtnActive: {
    backgroundColor: 'rgba(245, 200, 76, 0.18)',
    borderColor: palette.gold,
  },
  teamSelectText: {
    ...typography.caption,
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '700',
  },
  teamSelectTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Sequence – Online Multiplayer Screen (Create & Join Private Rooms)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ScreenBackground,
  GlassPanel,
  PrimaryButton,
  ScreenHeader,
  WakingUpServerView,
} from '../components';
import { palette, radius, spacing, typography } from '../theme';
import { ScreenProps } from './types';
import { useOnlineStore } from '../store/onlineStore';

export const OnlineScreen: React.FC<ScreenProps<'Online'>> = ({ route, navigation }) => {
  const initialTab = route.params?.initialTab || 'create';
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialTab);
  const [playerName, setPlayerName] = useState('Player');
  const [joinCode, setJoinCode] = useState('');
  const [teamCount, setTeamCount] = useState<2 | 3>(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onlineStatus = useOnlineStore((s) => s.status);
  const initSocket = useOnlineStore((s) => s.initSocket);
  const retryConnection = useOnlineStore((s) => s.retryConnection);

  const [isWakingUp, setIsWakingUp] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    initSocket();
    startTimeRef.current = Date.now();
  }, [initSocket]);

  useEffect(() => {
    if (onlineStatus === 'connected') {
      setIsWakingUp(false);
      return;
    }

    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(diff);
      if (diff >= 5) {
        setIsWakingUp(true);
      }
    }, 1000);


    return () => clearInterval(interval);
  }, [onlineStatus]);

  const handleRetry = () => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    retryConnection();
  };

  const createRoom = useOnlineStore((s) => s.createRoom);
  const joinRoom = useOnlineStore((s) => s.joinRoom);


  const handleTabChange = (tab: 'create' | 'join') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setActiveTab(tab);
    setError(null);
  };

  const handleCreateRoom = async () => {
    if (!playerName.trim() || isSubmitting) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setIsSubmitting(true);
    setError(null);

    const result = await createRoom(playerName.trim(), { teamCount });
    setIsSubmitting(false);

    if (result.success) {
      navigation.navigate('Lobby');
    } else {
      setError(result.error || 'Failed to create room.');
    }
  };

  const handleJoinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!playerName.trim() || code.length !== 6 || isSubmitting) {
      if (code.length !== 6) {
        setError('Room code must be exactly 6 characters.');
      }
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setIsSubmitting(true);
    setError(null);

    const result = await joinRoom(code, playerName.trim());
    setIsSubmitting(false);

    if (result.success) {
      navigation.navigate('Lobby');
    } else {
      setError(result.error || `Could not join room ${code}.`);
    }
  };

  if (isWakingUp && onlineStatus !== 'connected') {
    return (
      <ScreenBackground>
        <WakingUpServerView
          elapsedSeconds={elapsed}
          onRetry={handleRetry}
          onCancel={() => navigation.navigate('Home')}
        />
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <ScreenHeader
            title="PLAY ONLINE"
            subtitle="Cross-device real-time multiplayer"
            onBack={() => navigation.navigate('Home')}
          />

          {/* Tab Selector: Create vs Join */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleTabChange('create')}
              style={[
                styles.tabBtn,
                activeTab === 'create' && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'create' && styles.tabTextActive,
                ]}
              >
                Create Room
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleTabChange('join')}
              style={[
                styles.tabBtn,
                activeTab === 'join' && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'join' && styles.tabTextActive,
                ]}
              >
                Join Room
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* Form Content */}
          <GlassPanel style={styles.formCard}>
            {/* Player Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>YOUR NICKNAME</Text>
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

            {activeTab === 'create' ? (
              /* Create Room Section */
              <View style={styles.tabSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>TEAMS & GOAL</Text>
                  <View style={styles.teamSelectRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.teamOption,
                        teamCount === 2 && styles.teamOptionActive,
                      ]}
                      onPress={() => setTeamCount(2)}
                    >
                      <Text
                        style={[
                          styles.teamOptionText,
                          teamCount === 2 && styles.teamOptionTextActive,
                        ]}
                      >
                        2 Teams
                      </Text>
                      <Text style={styles.teamSubtext}>Goal: 2 Sequences</Text>
                      <View style={styles.chipsRow}>
                        <View style={[styles.miniChip, { backgroundColor: palette.red }]} />
                        <View style={[styles.miniChip, { backgroundColor: palette.blue }]} />
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.teamOption,
                        teamCount === 3 && styles.teamOptionActive,
                      ]}
                      onPress={() => setTeamCount(3)}
                    >
                      <Text
                        style={[
                          styles.teamOptionText,
                          teamCount === 3 && styles.teamOptionTextActive,
                        ]}
                      >
                        3 Teams
                      </Text>
                      <Text style={styles.teamSubtext}>Goal: 1 Sequence</Text>
                      <View style={styles.chipsRow}>
                        <View style={[styles.miniChip, { backgroundColor: palette.red }]} />
                        <View style={[styles.miniChip, { backgroundColor: palette.blue }]} />
                        <View style={[styles.miniChip, { backgroundColor: palette.green }]} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                <PrimaryButton
                  title={isSubmitting ? 'Creating Room...' : 'Create Private Room'}
                  variant="gold"
                  onPress={handleCreateRoom}
                  disabled={isSubmitting || !playerName.trim()}
                />
              </View>
            ) : (
              /* Join Room Section */
              <View style={styles.tabSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ROOM CODE (6 CHARACTERS)</Text>
                  <TextInput
                    style={[styles.textInput, styles.codeInput]}
                    value={joinCode}
                    onChangeText={(text) =>
                      setJoinCode(text.toUpperCase().slice(0, 6))
                    }
                    placeholder="ENTER 6-CHAR CODE"
                    placeholderTextColor="#64748B"
                    maxLength={6}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="go"
                    onSubmitEditing={handleJoinRoom}
                  />
                  <Text style={styles.helperText}>
                    Ask the room host for their 6-letter room code
                  </Text>
                </View>

                <PrimaryButton
                  title={isSubmitting ? 'Joining Room...' : 'Join Game Room'}
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

          {/* Quick Return to Home Button */}
          <View style={styles.footer}>
            <PrimaryButton
              title="Return to Home"
              variant="outline"
              onPress={() => navigation.navigate('Home')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    width: '100%',
    maxWidth: 420,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  tabBtnActive: {
    backgroundColor: palette.gold,
  },
  tabText: {
    ...typography.subtitle,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#060B14',
    fontWeight: '800',
  },
  errorBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#FCA5A5',
    ...typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    ...typography.caption,
    color: palette.gold,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  textInput: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.base,
    color: '#FFFFFF',
    ...typography.body,
    fontWeight: '600',
  },
  codeInput: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    borderColor: palette.gold,
  },
  helperText: {
    ...typography.caption,
    color: '#64748B',
    textAlign: 'center',
  },
  tabSection: {
    gap: spacing.lg,
  },
  teamSelectRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  teamOption: {
    flex: 1,
    minHeight: 76,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  teamOptionActive: {
    borderColor: palette.gold,
    backgroundColor: 'rgba(245, 200, 76, 0.15)',
  },
  teamOptionText: {
    ...typography.subtitle,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  teamOptionTextActive: {
    color: palette.gold,
  },
  teamSubtext: {
    ...typography.caption,
    fontSize: 11,
    color: '#94A3B8',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  miniChip: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footer: {
    width: '100%',
    maxWidth: 420,
    marginTop: spacing.xs,
  },
});

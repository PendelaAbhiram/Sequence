// ─────────────────────────────────────────────────────────────────────────────
// Sequence – Bot Mode Setup Screen
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ScreenBackground, GlassPanel, PrimaryButton, ScreenHeader } from '../components';
import { palette, radius, spacing, typography } from '../theme';
import { ScreenProps } from './types';
import { useGameStore } from '../store/gameStore';
import { BotDifficulty } from '../engine/bot';

export const BotSetupScreen: React.FC<ScreenProps<'BotSetup'>> = ({ navigation }) => {
  const [teamCount, setTeamCount] = useState<2 | 3>(2);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [userName, setUserName] = useState('Player 1');
  const [playerCount, setPlayerCount] = useState<number>(2); // 2 or 4 for 2 teams; 3 for 3 teams

  const startNewGame = useGameStore((s) => s.startNewGame);
  const setBotDifficulty = useGameStore((s) => s.setBotDifficulty);

  const handleTeamCountChange = (teams: 2 | 3) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setTeamCount(teams);
    if (teams === 3) {
      setPlayerCount(3);
    } else if (playerCount === 3) {
      setPlayerCount(2);
    }
  };

  const handleDifficultyChange = (d: BotDifficulty) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setDifficulty(d);
  };

  const handleStart = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const safeUserName = userName.trim() || 'Player 1';
    const playerNames: string[] = [safeUserName];

    if (teamCount === 2) {
      if (playerCount === 4) {
        playerNames.push('Bot Rival 1', 'Bot Ally', 'Bot Rival 2');
      } else {
        playerNames.push('Bot Opponent');
      }
    } else {
      playerNames.push('Bot Blue', 'Bot Green');
    }

    setBotDifficulty(difficulty);
    startNewGame({
      playerNames,
      teams: teamCount === 2 ? ['red', 'blue'] : ['red', 'blue', 'green'],
      settings: { mode: 'bot' },
    });

    navigation.navigate('Game');
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <ScreenHeader
          title="VS COMPUTER"
          subtitle="Configure match & AI difficulty"
          onBack={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('Home');
          }}
        />

        {/* Section 1: User Name */}
        <GlassPanel style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>YOUR NAME</Text>
          <TextInput
            value={userName}
            onChangeText={setUserName}
            placeholder="Enter your name"
            placeholderTextColor="#64748B"
            style={styles.textInput}
            maxLength={20}
          />
        </GlassPanel>

        {/* Section 2: Team Count */}
        <GlassPanel style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>TEAMS & GOAL</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.toggleOption,
                teamCount === 2 && styles.activeToggle,
              ]}
              onPress={() => handleTeamCountChange(2)}
            >
              <Text style={[styles.toggleText, teamCount === 2 && styles.activeToggleText]}>
                2 Teams
              </Text>
              <Text style={styles.toggleSubtext}>Goal: 2 Sequences</Text>
              <View style={styles.chipsRow}>
                <View style={[styles.miniChip, { backgroundColor: palette.red }]} />
                <View style={[styles.miniChip, { backgroundColor: palette.blue }]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.toggleOption,
                teamCount === 3 && styles.activeToggle,
              ]}
              onPress={() => handleTeamCountChange(3)}
            >
              <Text style={[styles.toggleText, teamCount === 3 && styles.activeToggleText]}>
                3 Teams
              </Text>
              <Text style={styles.toggleSubtext}>Goal: 1 Sequence</Text>
              <View style={styles.chipsRow}>
                <View style={[styles.miniChip, { backgroundColor: palette.red }]} />
                <View style={[styles.miniChip, { backgroundColor: palette.blue }]} />
                <View style={[styles.miniChip, { backgroundColor: palette.green }]} />
              </View>
            </TouchableOpacity>
          </View>
        </GlassPanel>

        {/* Section 3: AI Difficulty */}
        <GlassPanel style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>AI DIFFICULTY</Text>
          <View style={styles.difficultyGrid}>
            {(['easy', 'medium', 'hard'] as const).map((level) => {
              const isSelected = difficulty === level;
              return (
                <TouchableOpacity
                  key={level}
                  activeOpacity={0.8}
                  style={[
                    styles.diffBadge,
                    isSelected && styles.diffBadgeActive,
                  ]}
                  onPress={() => handleDifficultyChange(level)}
                >
                  <Text style={[styles.diffTitle, isSelected && styles.diffTitleActive]}>
                    {level.toUpperCase()}
                  </Text>
                  <Text style={styles.diffDesc}>
                    {level === 'easy'
                      ? 'Casual'
                      : level === 'medium'
                      ? 'Tactical'
                      : 'Master'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </GlassPanel>

        {/* Live Match Preview */}
        <GlassPanel variant="subtle" style={styles.previewCard}>
          <Text style={styles.previewHeader}>ROSTER PREVIEW</Text>
          <View style={styles.rosterList}>
            <View style={styles.rosterItem}>
              <View style={[styles.playerChip, { backgroundColor: palette.red }]}>
                <Text style={styles.playerChipText}>1</Text>
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{userName || 'Player 1'} (You)</Text>
                <Text style={[styles.teamLabel, { color: palette.red }]}>Team Red</Text>
              </View>
            </View>

            <View style={styles.rosterItem}>
              <View style={[styles.playerChip, { backgroundColor: palette.blue }]}>
                <Text style={styles.playerChipText}>2</Text>
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>Bot Rival (AI: {difficulty.toUpperCase()})</Text>
                <Text style={[styles.teamLabel, { color: palette.blue }]}>Team Blue</Text>
              </View>
            </View>

            {teamCount === 3 && (
              <View style={styles.rosterItem}>
                <View style={[styles.playerChip, { backgroundColor: palette.green }]}>
                  <Text style={styles.playerChipText}>3</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>Bot Green (AI: {difficulty.toUpperCase()})</Text>
                  <Text style={[styles.teamLabel, { color: palette.green }]}>Team Green</Text>
                </View>
              </View>
            )}
          </View>
        </GlassPanel>

        {/* Start Game Action */}
        <View style={styles.actionContainer}>
          <PrimaryButton
            title="Start Match"
            variant="gold"
            onPress={handleStart}
          />
        </View>
      </ScrollView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  header: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    position: 'relative',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 2,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    ...typography.subtitle,
    color: palette.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    ...typography.h2,
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    ...typography.caption,
    color: '#94A3B8',
    marginTop: 2,
  },
  sectionCard: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
  },
  sectionLabel: {
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
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  toggleOption: {
    flex: 1,
    minHeight: 80,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  activeToggle: {
    borderColor: palette.gold,
    backgroundColor: 'rgba(245, 200, 76, 0.15)',
  },
  toggleText: {
    ...typography.subtitle,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeToggleText: {
    color: palette.gold,
  },
  toggleSubtext: {
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
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  difficultyGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  diffBadge: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  diffBadgeActive: {
    borderColor: palette.gold,
    backgroundColor: 'rgba(245, 200, 76, 0.15)',
  },
  diffTitle: {
    ...typography.subtitle,
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '800',
  },
  diffTitleActive: {
    color: palette.gold,
  },
  diffDesc: {
    ...typography.caption,
    fontSize: 11,
    color: '#94A3B8',
  },
  previewCard: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
  },
  previewHeader: {
    ...typography.caption,
    color: '#94A3B8',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  rosterList: {
    gap: spacing.xs,
  },
  rosterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  playerChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  playerChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerName: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  teamLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
  actionContainer: {
    width: '100%',
    maxWidth: 420,
    marginTop: spacing.xs,
  },
});

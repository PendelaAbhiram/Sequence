// ─────────────────────────────────────────────────────────────────────────────
// Sequence – Friends Mode Setup Screen (Pass & Play on One Phone)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
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
import { handSizeForPlayerCount } from '../engine/deck';
import type { TeamId } from '../engine/types';

const ALLOWED_PLAYER_COUNTS = [2, 3, 4, 6, 8, 9, 10, 12] as const;

export const PlayerSetupScreen: React.FC<ScreenProps<'PlayerSetup'>> = ({ navigation }) => {
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [teamCount, setTeamCount] = useState<2 | 3>(2);
  const [playerNames, setPlayerNames] = useState<string[]>([
    'Player 1',
    'Player 2',
    'Player 3',
    'Player 4',
  ]);

  const startNewGame = useGameStore((s) => s.startNewGame);

  // Check which team options divide evenly for the current player count
  const canChoose2Teams = playerCount % 2 === 0;
  const canChoose3Teams = playerCount % 3 === 0;

  useEffect(() => {
    // Auto-adjust team count if current teamCount is invalid for new playerCount
    if (teamCount === 2 && !canChoose2Teams) {
      setTeamCount(3);
    } else if (teamCount === 3 && !canChoose3Teams) {
      setTeamCount(2);
    }

    // Adjust player names array size
    setPlayerNames((prev) => {
      const next = [...prev];
      if (next.length < playerCount) {
        for (let i = next.length; i < playerCount; i++) {
          next.push(`Player ${i + 1}`);
        }
      } else if (next.length > playerCount) {
        next.splice(playerCount);
      }
      return next;
    });
  }, [playerCount, canChoose2Teams, canChoose3Teams, teamCount]);

  const handlePlayerCountSelect = (count: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setPlayerCount(count);
  };

  const handleTeamCountSelect = (teams: 2 | 3) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setTeamCount(teams);
  };

  const handleNameChange = (text: string, index: number) => {
    setPlayerNames((prev) => {
      const copy = [...prev];
      copy[index] = text;
      return copy;
    });
  };

  const getTeamForSeat = (seatIndex: number): TeamId => {
    const teams: TeamId[] = teamCount === 2 ? ['red', 'blue'] : ['red', 'blue', 'green'];
    return teams[seatIndex % teams.length];
  };

  const getTeamColor = (team: TeamId): string => {
    switch (team) {
      case 'red': return palette.red;
      case 'blue': return palette.blue;
      case 'green': return palette.green;
    }
  };

  const handleStart = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const safeNames = playerNames.map((name, idx) => name.trim() || `Player ${idx + 1}`);
    const teams: TeamId[] = teamCount === 2 ? ['red', 'blue'] : ['red', 'blue', 'green'];

    startNewGame({
      playerNames: safeNames,
      teams,
      settings: { mode: 'local' },
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
          title="PASS & PLAY"
          subtitle="Setup players and seating"
          onBack={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('Home');
          }}
        />

        {/* 1. Player Count Selection */}
        <GlassPanel style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>PLAYER COUNT</Text>
            <Text style={styles.cardsPerPlayerBadge}>
              {handSizeForPlayerCount(playerCount)} cards each
            </Text>
          </View>
          <View style={styles.playerCountGrid}>
            {ALLOWED_PLAYER_COUNTS.map((count) => {
              const isSelected = count === playerCount;
              return (
                <TouchableOpacity
                  key={count}
                  activeOpacity={0.8}
                  style={[
                    styles.countBadge,
                    isSelected && styles.countBadgeActive,
                  ]}
                  onPress={() => handlePlayerCountSelect(count)}
                >
                  <Text style={[styles.countBadgeText, isSelected && styles.countBadgeTextActive]}>
                    {count}
                  </Text>
                  <Text style={[styles.countSubtext, isSelected && styles.countSubtextActive]}>
                    players
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </GlassPanel>

        {/* 2. Team Count Selection (2 or 3 teams) */}
        <GlassPanel style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>TEAM FORMAT</Text>
            <Text style={styles.goalText}>
              Goal: {teamCount === 2 ? '2 Sequences' : '1 Sequence'}
            </Text>
          </View>

          <View style={styles.teamSelectionRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!canChoose2Teams}
              style={[
                styles.teamOption,
                teamCount === 2 && styles.teamOptionActive,
                !canChoose2Teams && styles.teamOptionDisabled,
              ]}
              onPress={() => handleTeamCountSelect(2)}
            >
              <Text
                style={[
                  styles.teamOptionTitle,
                  teamCount === 2 && styles.teamOptionTitleActive,
                  !canChoose2Teams && styles.textDisabled,
                ]}
              >
                2 Teams (Red vs Blue)
              </Text>
              <Text style={styles.teamOptionDesc}>
                {canChoose2Teams
                  ? `${playerCount / 2} players per team`
                  : 'Requires even player count'}
              </Text>
              <View style={styles.miniChipsRow}>
                <View style={[styles.miniDot, { backgroundColor: palette.red }]} />
                <View style={[styles.miniDot, { backgroundColor: palette.blue }]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!canChoose3Teams}
              style={[
                styles.teamOption,
                teamCount === 3 && styles.teamOptionActive,
                !canChoose3Teams && styles.teamOptionDisabled,
              ]}
              onPress={() => handleTeamCountSelect(3)}
            >
              <Text
                style={[
                  styles.teamOptionTitle,
                  teamCount === 3 && styles.teamOptionTitleActive,
                  !canChoose3Teams && styles.textDisabled,
                ]}
              >
                3 Teams (Red, Blue, Green)
              </Text>
              <Text style={styles.teamOptionDesc}>
                {canChoose3Teams
                  ? `${playerCount / 3} players per team`
                  : 'Divisible by 3 (3, 6, 9, 12)'}
              </Text>
              <View style={styles.miniChipsRow}>
                <View style={[styles.miniDot, { backgroundColor: palette.red }]} />
                <View style={[styles.miniDot, { backgroundColor: palette.blue }]} />
                <View style={[styles.miniDot, { backgroundColor: palette.green }]} />
              </View>
            </TouchableOpacity>
          </View>
        </GlassPanel>

        {/* 3. Seating Order & Live Team Assignment Preview */}
        <GlassPanel style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>SEATING & TEAMS</Text>
            <Text style={styles.seatingRuleNotice}>Clockwise • Alternating</Text>
          </View>

          <View style={styles.seatingList}>
            {playerNames.map((name, index) => {
              const team = getTeamForSeat(index);
              const color = getTeamColor(team);
              const teamLabel = team === 'red' ? 'Red' : team === 'blue' ? 'Blue' : 'Green';

              return (
                <View key={index} style={styles.seatRow}>
                  <View style={[styles.seatBadge, { backgroundColor: color }]}>
                    <Text style={styles.seatNumberText}>{index + 1}</Text>
                  </View>

                  <TextInput
                    value={name}
                    onChangeText={(val) => handleNameChange(val, index)}
                    placeholder={`Player ${index + 1}`}
                    placeholderTextColor="#64748B"
                    style={styles.nameInput}
                    maxLength={16}
                  />

                  <View style={[styles.teamPill, { borderColor: color }]}>
                    <View style={[styles.teamDot, { backgroundColor: color }]} />
                    <Text style={[styles.teamPillText, { color }]}>{teamLabel}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </GlassPanel>

        {/* Start Game Action */}
        <View style={styles.actionContainer}>
          <PrimaryButton
            title={`Start Match (${playerCount} Players)`}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    ...typography.caption,
    color: palette.gold,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cardsPerPlayerBadge: {
    ...typography.caption,
    color: '#93C5FD',
    fontWeight: '700',
  },
  goalText: {
    ...typography.caption,
    color: palette.gold,
    fontWeight: '700',
  },
  seatingRuleNotice: {
    ...typography.caption,
    fontSize: 11,
    color: '#94A3B8',
  },
  playerCountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  countBadge: {
    width: '23%',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  countBadgeActive: {
    borderColor: palette.gold,
    backgroundColor: 'rgba(245, 200, 76, 0.18)',
  },
  countBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  countBadgeTextActive: {
    color: palette.gold,
  },
  countSubtext: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  countSubtextActive: {
    color: palette.gold,
  },
  teamSelectionRow: {
    gap: spacing.xs,
  },
  teamOption: {
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    gap: 2,
  },
  teamOptionActive: {
    borderColor: palette.gold,
    backgroundColor: 'rgba(245, 200, 76, 0.14)',
  },
  teamOptionDisabled: {
    opacity: 0.35,
  },
  teamOptionTitle: {
    ...typography.subtitle,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  teamOptionTitleActive: {
    color: palette.gold,
  },
  teamOptionDesc: {
    ...typography.caption,
    fontSize: 11,
    color: '#94A3B8',
  },
  textDisabled: {
    color: '#64748B',
  },
  miniChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  miniDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  seatingList: {
    gap: spacing.xs,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 46,
  },
  seatBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatNumberText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  nameInput: {
    flex: 1,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: spacing.sm,
    color: '#FFFFFF',
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  teamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionContainer: {
    width: '100%',
    maxWidth: 420,
    marginTop: spacing.xs,
  },
});

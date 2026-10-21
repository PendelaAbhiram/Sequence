// ─────────────────────────────────────────────────────────────────────────────
// Sequence – Result Screen with Winner Banner, Confetti & Match Stats
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ScreenBackground, GlassPanel, PrimaryButton } from '../components';
import { palette, radius, spacing, typography } from '../theme';
import { ScreenProps } from './types';
import { useGameStore } from '../store/gameStore';
import { useOnlineStore } from '../store/onlineStore';
import { useSettingsStore } from '../store/settingsStore';
import { soundManager } from '../utils/audio';

export const ResultScreen: React.FC<ScreenProps<'Result'>> = ({ navigation }) => {
  const game = useGameStore((s) => s.game);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const clearSavedGame = useGameStore((s) => s.clearSavedGame);
  const recordMatchResult = useSettingsStore((s) => s.recordMatchResult);

  const isOnline = useOnlineStore((s) => s.isOnline);
  const onlineGameState = useOnlineStore((s) => s.gameState);
  const onlinePlayerId = useOnlineStore((s) => s.playerId);
  const leaveRoom = useOnlineStore((s) => s.leaveRoom);

  const activeWinner = isOnline ? onlineGameState?.winner : game?.winner;
  const winningTeam = activeWinner ?? 'red';
  const winningTeamName =
    winningTeam === 'red'
      ? 'Team Red'
      : winningTeam === 'blue'
      ? 'Team Blue'
      : 'Team Green';
  const winningColor =
    winningTeam === 'red'
      ? palette.red
      : winningTeam === 'blue'
      ? palette.blue
      : palette.green;

  // Calculate detailed match statistics
  const stats = useMemo(() => {
    const board = isOnline ? onlineGameState?.board : game?.board;
    if (!board) {
      return {
        totalChips: 0,
        jacksCount: 0,
        chipsByTeam: { red: 0, blue: 0, green: 0 },
      };
    }

    let totalChips = 0;
    const chipsByTeam = { red: 0, blue: 0, green: 0 };

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = board[r][c];
        if (cell.chip) {
          totalChips++;
          chipsByTeam[cell.chip] = (chipsByTeam[cell.chip] || 0) + 1;
        }
      }
    }

    let jacksCount = 0;
    if (isOnline && onlineGameState) {
      for (const pile of Object.values(onlineGameState.discardPiles || {})) {
        jacksCount += pile.filter((c) => c.rank === 'J').length;
      }
    } else if (game) {
      jacksCount = game.players.reduce((acc, p) => {
        const jacks = p.discardPile.filter((c) => c.rank === 'J').length;
        return acc + jacks;
      }, 0);
    }

    return { totalChips, jacksCount, chipsByTeam };
  }, [isOnline, onlineGameState, game]);

  // Record stats once on mount
  useEffect(() => {
    if (!game && !onlineGameState) return;

    soundManager.playWinFanfare();
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    if (isOnline && onlineGameState) {
      const me = onlineGameState.players.find((p) => p.id === onlinePlayerId);
      const won = onlineGameState.winner === me?.teamId;
      const seqCount = onlineGameState.sequenceCounts[winningTeam] ?? 0;

      recordMatchResult({
        won,
        isBotMode: false,
        chipsPlacedCount: stats.totalChips,
        jacksCount: stats.jacksCount,
        sequencesCount: seqCount,
      });
    } else if (game) {
      const isBot = game.settings.mode === 'bot';
      const humanWon = game.winner === game.players[0].teamId;
      const seqCount = game.sequenceCounts[winningTeam] ?? 0;

      recordMatchResult({
        won: humanWon,
        isBotMode: isBot,
        chipsPlacedCount: stats.totalChips,
        jacksCount: stats.jacksCount,
        sequencesCount: seqCount,
      });
    }
  }, [game, isOnline, onlineGameState, onlinePlayerId, winningTeam, stats, recordMatchResult]);

  // Rematch with the exact same players and setup
  const handleRematch = () => {
    if (isOnline) {
      navigation.navigate('Lobby');
      return;
    }
    if (!game) return;
    clearSavedGame();
    startNewGame({
      playerNames: game.players.map((p) => p.name),
      teams: game.teams,
      settings: game.settings,
    });
    navigation.navigate('Game');
  };

  const handleHome = async () => {
    if (isOnline) {
      await leaveRoom();
    } else {
      clearSavedGame();
    }
    navigation.navigate('Home');
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated Trophy & Winner Announcement */}
        <Animated.View entering={ZoomIn.duration(400)} style={styles.header}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.congratsText}>CHAMPIONS OF THE BOARD</Text>
          <Text style={styles.title}>VICTORY!</Text>

          {/* Winner Banner */}
          <View style={[styles.winnerBanner, { borderColor: winningColor }]}>
            <View style={[styles.winnerChipCircle, { backgroundColor: winningColor }]} />
            <Text style={[styles.winnerText, { color: winningColor }]}>
              {winningTeamName.toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        {/* Detailed Stats Panel */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.panelContainer}>
          <GlassPanel style={styles.panel}>
            <Text style={styles.statsHeader}>MATCH STATISTICS</Text>

            {/* Sequence Scores per team */}
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Team Red Sequences</Text>
              <Text style={[styles.statValue, { color: palette.red }]}>
                {isOnline
                  ? onlineGameState?.sequenceCounts.red ?? 0
                  : game?.sequenceCounts.red ?? 0}
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Team Blue Sequences</Text>
              <Text style={[styles.statValue, { color: palette.blue }]}>
                {isOnline
                  ? onlineGameState?.sequenceCounts.blue ?? 0
                  : game?.sequenceCounts.blue ?? 0}
              </Text>
            </View>

            {((isOnline && onlineGameState?.sequenceCounts.green !== undefined) ||
              game?.teams.includes('green')) && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Team Green Sequences</Text>
                <Text style={[styles.statValue, { color: palette.green }]}>
                  {isOnline
                    ? onlineGameState?.sequenceCounts.green ?? 0
                    : game?.sequenceCounts.green ?? 0}
                </Text>
              </View>
            )}

            {/* Chips Placed */}
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Active Chips on Board</Text>
              <Text style={styles.statValue}>{stats.totalChips} chips</Text>
            </View>

            {/* Jacks Used */}
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Jacks Played (Wild & Remove)</Text>
              <Text style={[styles.statValue, { color: palette.gold }]}>
                {stats.jacksCount} Jacks
              </Text>
            </View>

            {/* Match Mode */}
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Game Mode</Text>
              <Text style={styles.statValue}>
                {isOnline
                  ? 'Online Multiplayer'
                  : game?.settings.mode === 'bot'
                  ? 'vs Computer (AI)'
                  : 'Pass & Play'}
              </Text>
            </View>
          </GlassPanel>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeIn.duration(400).delay(400)} style={styles.footer}>
          <PrimaryButton
            title="Rematch"
            variant="gold"
            onPress={handleRematch}
          />
          <PrimaryButton
            title="Back to Home"
            variant="outline"
            onPress={handleHome}
          />
        </Animated.View>
      </ScrollView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  trophy: {
    fontSize: 56,
    marginBottom: 2,
  },
  congratsText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 2,
  },
  title: {
    ...typography.h1,
    fontSize: 38,
    lineHeight: 44,
    color: palette.gold,
    letterSpacing: 3,
  },
  winnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    marginTop: spacing.xs,
  },
  winnerChipCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  winnerText: {
    ...typography.subtitle,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  panelContainer: {
    width: '100%',
    maxWidth: 420,
  },
  panel: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  statsHeader: {
    ...typography.caption,
    color: palette.gold,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  statLabel: {
    ...typography.body,
    fontSize: 13,
    color: '#CBD5E1',
  },
  statValue: {
    ...typography.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  footer: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});

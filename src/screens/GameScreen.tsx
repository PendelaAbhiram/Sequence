// ─────────────────────────────────────────────────────────────────────────────
// Sequence – Game Screen (Local Bot, Pass & Play, and Online Multiplayer)
// 60fps Reanimated Wow Layer, Opponent Status, Connection Indicator & Sound FX
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ScreenBackground,
  BoardView,
  HandCardView,
  DiscardPileBottomSheet,
  PassAndPlayCover,
  GameIntroAnimation,
  SequenceCelebration,
  TurnBanner,
  ReshuffleBanner,
} from '../components';
import { palette, radius, spacing, typography } from '../theme';
import { useResponsiveLayout } from '../utils';
import { ScreenProps } from './types';
import { useGameStore } from '../store/gameStore';
import { useOnlineStore } from '../store/onlineStore';
import { isDeadCard } from '../engine/board';
import { requiredSequences, Sequence } from '../engine/sequenceDetector';
import { soundManager } from '../utils/audio';
import { TeamId, Card } from '../engine/types';

export const GameScreen: React.FC<ScreenProps<'Game'>> = ({ navigation }) => {
  const layout = useResponsiveLayout();

  // ── Online Store Bindings ───────────────────────────────────────────────────
  const isOnline = useOnlineStore((s) => s.isOnline);
  const onlineGameState = useOnlineStore((s) => s.gameState);
  const onlinePlayerId = useOnlineStore((s) => s.playerId);
  const onlineStatus = useOnlineStore((s) => s.status);
  const onlineSelectedCard = useOnlineStore((s) => s.selectedCard);
  const onlineValidTargets = useOnlineStore((s) => s.validTargets);
  const onlineSelectCard = useOnlineStore((s) => s.selectCard);
  const onlinePlayMove = useOnlineStore((s) => s.playMove);
  const onlineDiscardDeadCard = useOnlineStore((s) => s.discardDeadCard);

  // ── Local / Bot Store Bindings ──────────────────────────────────────────────
  const game = useGameStore((s) => s.game);
  const selectedCard = useGameStore((s) => s.selectedCard);
  const validTargets = useGameStore((s) => s.validTargets);
  const isBotThinking = useGameStore((s) => s.isBotThinking);

  const selectCard = useGameStore((s) => s.selectCard);
  const playMove = useGameStore((s) => s.playMove);
  const discardDeadCard = useGameStore((s) => s.discardDeadCard);
  const getCurrentPlayer = useGameStore((s) => s.getCurrentPlayer);
  const isCurrentPlayerBot = useGameStore((s) => s.isCurrentPlayerBot);

  // ── Modal & Overlay States ──────────────────────────────────────────────────
  const [discardSheetVisible, setDiscardSheetVisible] = useState(false);
  // In online mode, start immediately; in local mode, show cut-the-deck intro
  const [introVisible, setIntroVisible] = useState(!isOnline);
  const [passCoverVisible, setPassCoverVisible] = useState(false);
  const [turnBannerVisible, setTurnBannerVisible] = useState(false);
  const [reshuffleVisible, setReshuffleVisible] = useState(false);
  const [sequenceCelebrationTeam, setSequenceCelebrationTeam] = useState<TeamId | null>(null);

  // Audio toggles
  const [sfxOn, setSfxOn] = useState(soundManager.isSoundEnabled());
  const [bgmOn, setBgmOn] = useState(soundManager.isMusicEnabled());

  // ── Unified Data Derivations ────────────────────────────────────────────────
  const activeBoard = isOnline ? onlineGameState?.board : game?.board;
  const activeHand = isOnline
    ? (onlineGameState?.hand ?? [])
    : (getCurrentPlayer()?.hand ?? []);
  const activeSelectedCard = isOnline ? onlineSelectedCard : selectedCard;
  const activeValidTargets = isOnline ? onlineValidTargets : validTargets;
  const activeCompletedSequences = isOnline
    ? (onlineGameState?.completedSequences ?? [])
    : (game?.completedSequences ?? []);
  const activeSequenceCounts = isOnline
    ? (onlineGameState?.sequenceCounts ?? { red: 0, blue: 0, green: 0 })
    : (game?.sequenceCounts ?? { red: 0, blue: 0, green: 0 });
  const activeSequencesNeeded = isOnline
    ? (onlineGameState?.sequencesNeeded ?? 2)
    : (game ? requiredSequences(game.teams.length) : 2);
  const activeLastMove = isOnline ? onlineGameState?.lastMove : game?.lastMove;
  const activeWinner = isOnline ? onlineGameState?.winner : game?.winner;
  const activeReshuffle = isOnline
    ? onlineGameState?.reshuffleOccurred
    : game?.reshuffleOccurred;

  // Turn player derivation
  const onlineTurnPlayer = useMemo(() => {
    if (!onlineGameState) return null;
    return (
      onlineGameState.players.find((p) => p.id === onlineGameState.turnPlayerId) ??
      onlineGameState.players[onlineGameState.currentPlayerIndex] ??
      null
    );
  }, [onlineGameState]);

  const currentPlayer = isOnline ? null : getCurrentPlayer();
  const isBot = isOnline ? false : isCurrentPlayerBot();

  const activePlayerName = isOnline
    ? (onlineTurnPlayer?.name ?? 'Player')
    : (currentPlayer?.name ?? 'Player');
  const activeTeam = isOnline
    ? (onlineTurnPlayer?.teamId ?? 'red')
    : (currentPlayer?.teamId ?? 'red');
  const activeTeamColor =
    activeTeam === 'red'
      ? palette.red
      : activeTeam === 'blue'
      ? palette.blue
      : palette.green;

  const isMyTurnOnline = isOnline && onlinePlayerId === onlineGameState?.turnPlayerId;
  const canInteract = isOnline
    ? isMyTurnOnline
    : (!isBot && !isBotThinking && !passCoverVisible);

  // Unified players for DiscardSheet
  const playersForDiscard = useMemo(() => {
    if (isOnline && onlineGameState) {
      return onlineGameState.players.map((p) => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        teamId: p.teamId,
        hand: [], // Opponents' secret hands are hidden
        discardPile: p.discardPile || onlineGameState.discardPiles[p.id] || [],
        isBot: Boolean(p.isBotControlled),
      }));
    }
    return game?.players ?? [];
  }, [isOnline, onlineGameState, game?.players]);

  // Track sequence count & last move to fire celebrations and sound effects
  const prevSeqCount = useRef<number>(activeCompletedSequences.length);
  const prevMoveTimestamp = useRef<number>(activeLastMove?.timestamp ?? 0);
  const prevTurnIndex = useRef<number>(
    isOnline ? (onlineGameState?.currentPlayerIndex ?? -1) : (game?.currentPlayerIndex ?? -1)
  );

  // Auto-navigate to Result screen when match finishes with a winner
  useEffect(() => {
    if (activeWinner) {
      soundManager.playWinFanfare();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      const timer = setTimeout(() => {
        navigation.navigate('Result');
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [activeWinner, navigation]);

  // Pass-and-play privacy cover management (LOCAL ONLY - completely suppressed in online mode)
  useEffect(() => {
    if (isOnline || !game) {
      setPassCoverVisible(false);
      return;
    }

    if (game.settings.mode === 'local') {
      if (!introVisible) {
        setPassCoverVisible(true);
      }
    } else {
      setPassCoverVisible(false);
    }
  }, [game?.currentPlayerIndex, game?.settings.mode, introVisible, isOnline]);

  // Turn banner trigger
  useEffect(() => {
    if (introVisible || passCoverVisible) return;
    const currentTurn = isOnline
      ? onlineGameState?.currentPlayerIndex ?? -1
      : game?.currentPlayerIndex ?? -1;

    if (currentTurn !== -1 && prevTurnIndex.current !== currentTurn) {
      prevTurnIndex.current = currentTurn;
      setTurnBannerVisible(true);
      const timer = setTimeout(() => {
        setTurnBannerVisible(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [
    isOnline,
    onlineGameState?.currentPlayerIndex,
    game?.currentPlayerIndex,
    introVisible,
    passCoverVisible,
  ]);

  // Last Move Sound Effects, Animations & Reshuffle Detection
  useEffect(() => {
    // Check if new sequence was formed
    const currentSeqCount = activeCompletedSequences.length;
    if (currentSeqCount > prevSeqCount.current) {
      const latest = activeCompletedSequences[currentSeqCount - 1];
      if (latest) {
        setSequenceCelebrationTeam(latest.team);
      }
      prevSeqCount.current = currentSeqCount;
    }

    // Check last move type for sound effect (applies to opponents and local players equally)
    if (activeLastMove && activeLastMove.timestamp !== prevMoveTimestamp.current) {
      prevMoveTimestamp.current = activeLastMove.timestamp;
      if (activeLastMove.type === 'place') {
        soundManager.playChipClick();
      } else if (activeLastMove.type === 'remove') {
        soundManager.playChipRemove();
      }
    }

    // Check if discard pile reshuffle occurred
    if (activeReshuffle) {
      setReshuffleVisible(true);
    }
  }, [activeCompletedSequences, activeLastMove, activeReshuffle]);

  // All cells from all completed sequences to highlight on board
  const allCompletedSequenceCells = useMemo(() => {
    if (!activeCompletedSequences) return [];
    const cells: [number, number][] = [];
    for (const seq of activeCompletedSequences) {
      for (const [r, c] of seq.cells) {
        cells.push([r, c]);
      }
    }
    return cells;
  }, [activeCompletedSequences]);

  if ((isOnline && !onlineGameState) || (!isOnline && (!game || !currentPlayer))) {
    return (
      <ScreenBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.gold} />
          <Text style={styles.loadingText}>
            {isOnline ? 'Connecting to online match...' : 'Initializing Sequence match...'}
          </Text>
        </View>
      </ScreenBackground>
    );
  }

  // Handle board cell tap
  const handleCellPress = (r: number, c: number) => {
    if (!canInteract || !activeSelectedCard) return;

    // Check if tapped cell is among valid targets
    const isValid = activeValidTargets.some(([tr, tc]) => tr === r && tc === c);
    if (!isValid) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    if (isOnline) {
      onlinePlayMove([r, c], activeSelectedCard.id);
    } else {
      playMove([r, c], activeSelectedCard.id);
    }
  };

  const handleCardPress = (cardId: string) => {
    if (!canInteract) return;

    if (isOnline) {
      if (activeSelectedCard?.id === cardId) {
        onlineSelectCard(null);
      } else {
        onlineSelectCard(cardId);
      }
    } else {
      if (selectedCard?.id === cardId) {
        selectCard(null);
      } else {
        selectCard(cardId);
      }
    }
  };

  const handleDiscardDead = (cardId: string) => {
    if (!canInteract) return;
    if (isOnline) {
      onlineDiscardDeadCard(cardId);
    } else {
      discardDeadCard(cardId);
    }
  };

  const toggleSfx = () => {
    const next = soundManager.toggleSound();
    setSfxOn(next);
  };

  const toggleBgm = () => {
    const next = soundManager.toggleMusic();
    setBgmOn(next);
  };

  const lastMoveCell = activeLastMove?.cell ?? null;
  const lastMoveType = activeLastMove?.type ?? 'place';

  // Calculate fanning rotation angles for hand cards
  const handCount = activeHand.length;
  const middleIdx = (handCount - 1) / 2;

  // Dynamic board cell size ensuring board fits cleanly on small phones & scales on tablets
  const maxCellSize = layout.isTablet ? 54 : 38;
  const optimalCellSize = Math.max(
    28,
    Math.min(Math.floor((layout.availableWidth - 20) / 10), maxCellSize)
  );

  return (
    <ScreenBackground showSuits={false}>
      <View style={styles.screenWrapper}>
        {/* Reconnecting banner for online mode */}
        {isOnline && onlineStatus !== 'connected' && (
          <View style={styles.reconnectBanner}>
            <ActivityIndicator size="small" color="#F59E0B" />
            <Text style={styles.reconnectText}>
              {onlineStatus === 'connecting'
                ? 'Reconnecting to game...'
                : 'Connection lost. Auto-reconnecting...'}
            </Text>
          </View>
        )}

        {/* Top Navigation & Status Bar */}
        <View style={styles.topBar}>
          {/* Active Turn Indicator */}
          <View style={styles.turnBadgeContainer}>
            <View style={[styles.playerChipCircle, { backgroundColor: activeTeamColor }]}>
              <Text style={styles.playerChipText}>
                {isOnline ? (onlineTurnPlayer?.seat ?? 0) + 1 : (currentPlayer?.seat ?? 0) + 1}
              </Text>
            </View>
            <View>
              <Text style={styles.turnName} numberOfLines={1}>
                {activePlayerName} {isOnline && isMyTurnOnline ? '(You)' : ''}
              </Text>
              <Text style={[styles.teamSubtext, { color: activeTeamColor }]}>
                {isOnline
                  ? isMyTurnOnline
                    ? '🎯 Your Turn'
                    : `Waiting for ${activePlayerName}...`
                  : isBotThinking
                  ? '🤖 Thinking...'
                  : `Team ${activeTeam.toUpperCase()}`}
              </Text>
            </View>
          </View>

          {/* Sequence Score Badges & Audio Toggles */}
          <View style={styles.scoresRow}>
            {/* Online Connection Dot */}
            {isOnline && (
              <View style={styles.networkDotContainer}>
                <View
                  style={[
                    styles.networkDot,
                    {
                      backgroundColor:
                        onlineStatus === 'connected'
                          ? '#22C55E'
                          : onlineStatus === 'connecting'
                          ? '#F59E0B'
                          : '#EF4444',
                    },
                  ]}
                />
              </View>
            )}

            {/* Audio Toggles */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={toggleSfx}
              style={[styles.audioBtn, !sfxOn && styles.audioBtnMuted]}
              accessibilityLabel={sfxOn ? 'Mute sound effects' : 'Unmute sound effects'}
            >
              <Text style={styles.audioBtnText}>{sfxOn ? '🔊' : '🔇'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={toggleBgm}
              style={[styles.audioBtn, !bgmOn && styles.audioBtnMuted]}
              accessibilityLabel={bgmOn ? 'Mute background music' : 'Play background music'}
            >
              <Text style={styles.audioBtnText}>{bgmOn ? '🎵' : '⏸️'}</Text>
            </TouchableOpacity>

            {/* Score Badges */}
            <View style={[styles.teamScoreBadge, { borderColor: palette.red }]}>
              <View style={[styles.dot, { backgroundColor: palette.red }]} />
              <Text style={styles.scoreText}>
                {activeSequenceCounts.red ?? 0}/{activeSequencesNeeded}
              </Text>
            </View>

            <View style={[styles.teamScoreBadge, { borderColor: palette.blue }]}>
              <View style={[styles.dot, { backgroundColor: palette.blue }]} />
              <Text style={styles.scoreText}>
                {activeSequenceCounts.blue ?? 0}/{activeSequencesNeeded}
              </Text>
            </View>

            {activeSequenceCounts.green !== undefined && (
              <View style={[styles.teamScoreBadge, { borderColor: palette.green }]}>
                <View style={[styles.dot, { backgroundColor: palette.green }]} />
                <Text style={styles.scoreText}>
                  {activeSequenceCounts.green ?? 0}/{activeSequencesNeeded}
                </Text>
              </View>
            )}

            {/* Discard Pile Action Button */}
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.discardSheetBtn}
              onPress={() => setDiscardSheetVisible(true)}
              accessibilityLabel="View player discard piles"
            >
              <Text style={styles.discardSheetBtnText}>🂠</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Online Opponents Row: Shows card counts for all other players */}
        {isOnline && onlineGameState && (
          <View style={styles.opponentsRowWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.opponentsScroll}
            >
              {onlineGameState.players.map((p) => {
                const isMe = p.id === onlinePlayerId;
                const isTurn = p.id === onlineGameState.turnPlayerId;
                const teamColor =
                  p.teamId === 'red'
                    ? palette.red
                    : p.teamId === 'blue'
                    ? palette.blue
                    : palette.green;

                return (
                  <View
                    key={p.id}
                    style={[
                      styles.opponentPill,
                      isTurn && { borderColor: teamColor, backgroundColor: 'rgba(255, 255, 255, 0.12)' },
                      isMe && styles.myPill,
                    ]}
                  >
                    <View style={[styles.miniSeatDot, { backgroundColor: teamColor }]}>
                      <Text style={styles.miniSeatText}>{p.seat + 1}</Text>
                    </View>
                    <View>
                      <Text style={styles.opponentPillName} numberOfLines={1}>
                        {p.name} {isMe ? '(You)' : ''}
                      </Text>
                      <Text style={styles.opponentCardCount}>
                        {isMe ? `${activeHand.length} cards` : `🂠 ${p.cardCount} cards`}
                        {!p.isConnected && (p.isBotControlled ? ' • 🤖' : ' • ⚪')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Center: Interactive 10x10 Board with pinch/double-tap zoom */}
        <View style={styles.boardCenterSection}>
          <BoardView
            board={activeBoard!}
            cellSize={optimalCellSize}
            validTargets={activeValidTargets}
            lastMoveCell={lastMoveCell}
            lastMoveType={lastMoveType}
            highlightedSequenceCells={allCompletedSequenceCells}
            onCellPress={handleCellPress}
            isInteractive={canInteract}
          />
        </View>

        {/* Bottom Section: Hand Tray & Fanned Cards (Show ONLY MY OWN HAND) */}
        <View style={styles.handSection}>
          <View style={styles.handHeader}>
            <Text style={styles.handTitle}>
              YOUR HAND ({activeHand.length} CARDS)
            </Text>
            {activeSelectedCard ? (
              <Text style={styles.selectionHint}>
                Tap a highlighted board cell to place chip
              </Text>
            ) : isOnline && !isMyTurnOnline ? (
              <Text style={styles.waitTurnHint}>
                Waiting for {activePlayerName}'s turn...
              </Text>
            ) : null}
          </View>

          {/* Fanned Cards Scroll Container */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fannedCardsContainer}
          >
            {activeHand.map((card, idx) => {
              const isSelected = activeSelectedCard?.id === card.id;
              const isDead = activeBoard ? isDeadCard(activeBoard, card) : false;
              // Fan rotation (-10deg to +10deg)
              const rotation = Math.max(-10, Math.min(10, (idx - middleIdx) * 3));

              return (
                <HandCardView
                  key={card.id}
                  card={card}
                  isSelected={isSelected}
                  isDead={isDead}
                  rotationDeg={rotation}
                  onPress={() => handleCardPress(card.id)}
                  onDiscardDead={() => handleDiscardDead(card.id)}
                  disabled={!canInteract}
                />
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Discard Piles Bottom Sheet */}
      <DiscardPileBottomSheet
        visible={discardSheetVisible}
        players={playersForDiscard as any}
        onClose={() => setDiscardSheetVisible(false)}
      />

      {/* Game Start: Cut the Deck Card Dealing Animation (Local / Bot mode only) */}
      {!isOnline && game && (
        <GameIntroAnimation
          visible={introVisible}
          players={game.players}
          dealerIndex={game.dealerIndex}
          cutCards={game.cutCards}
          onComplete={() => {
            setIntroVisible(false);
            if (game.settings.mode === 'local') {
              setPassCoverVisible(true);
            }
          }}
        />
      )}

      {/* Sliding Turn-Change Banner */}
      <TurnBanner
        visible={turnBannerVisible && !passCoverVisible}
        playerName={activePlayerName}
        teamId={activeTeam}
        isBot={isBot}
      />

      {/* Draw-Pile Reshuffle Alert */}
      <ReshuffleBanner
        visible={reshuffleVisible}
        onDismiss={() => setReshuffleVisible(false)}
      />

      {/* Sequence Formed Celebration: Glowing line + Confetti + "SEQUENCE!" */}
      {sequenceCelebrationTeam && (
        <SequenceCelebration
          visible={Boolean(sequenceCelebrationTeam)}
          teamId={sequenceCelebrationTeam}
          onDismiss={() => setSequenceCelebrationTeam(null)}
        />
      )}

      {/* Pass-and-Play Privacy Cover for Friends Mode (LOCAL ONLY, never in online mode) */}
      {!isOnline && (
        <PassAndPlayCover
          visible={passCoverVisible && !introVisible}
          playerName={activePlayerName}
          playerSeat={currentPlayer?.seat ?? 0}
          teamId={activeTeam}
          onReveal={() => setPassCoverVisible(false)}
        />
      )}
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  reconnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
  },
  reconnectText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#FDE68A',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(10, 20, 32, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  turnBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '40%',
  },
  playerChipCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerChipText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  turnName: {
    ...typography.subtitle,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  teamSubtext: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  scoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  networkDotContainer: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  audioBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioBtnMuted: {
    opacity: 0.45,
  },
  audioBtnText: {
    fontSize: 13,
  },
  teamScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  scoreText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  discardSheetBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  discardSheetBtnText: {
    fontSize: 16,
    color: palette.gold,
  },
  opponentsRowWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  opponentsScroll: {
    paddingHorizontal: spacing.base,
    gap: 6,
    alignItems: 'center',
  },
  opponentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  myPill: {
    backgroundColor: 'rgba(245, 200, 76, 0.12)',
    borderColor: 'rgba(245, 200, 76, 0.35)',
  },
  miniSeatDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSeatText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  opponentPillName: {
    ...typography.caption,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    maxWidth: 90,
  },
  opponentCardCount: {
    ...typography.caption,
    fontSize: 10,
    color: '#94A3B8',
  },
  boardCenterSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  handSection: {
    backgroundColor: 'rgba(8, 18, 30, 0.88)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  handHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  handTitle: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: palette.gold,
    letterSpacing: 1.5,
  },
  selectionHint: {
    ...typography.caption,
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  waitTurnHint: {
    ...typography.caption,
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  fannedCardsContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.subtitle,
    color: '#FFFFFF',
  },
});

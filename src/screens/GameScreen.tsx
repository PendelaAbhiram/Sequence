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
  BackHandler,
  Modal,
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
  PrimaryButton,
  RoomCodePill,
} from '../components';
import { palette, radius, spacing, typography } from '../theme';
import { useResponsiveLayout } from '../utils';
import { ScreenProps } from './types';
import { useGameStore, clearBotTimer, GAME_SAVE_STORAGE_KEY } from '../store/gameStore';
import { useOnlineStore } from '../store/onlineStore';
import { storage } from '../utils/storage';
import { isDeadCard } from '../engine/board';
import { requiredSequences, Sequence } from '../engine/sequenceDetector';
import { soundManager } from '../utils/audio';
import { TeamId, Card } from '../engine/types';

export const GameScreen: React.FC<ScreenProps<'Game'>> = ({ navigation }) => {
  const layout = useResponsiveLayout();

  // ── Online Store Bindings ───────────────────────────────────────────────────
  const isOnline = useOnlineStore((s) => s.isOnline);
  const onlineGameState = useOnlineStore((s) => s.gameState);
  const room = useOnlineStore((s) => s.room);
  const onlineRoomCode = onlineGameState?.roomCode ?? room?.roomCode ?? null;
  const onlinePlayerId = useOnlineStore((s) => s.playerId);
  const onlineStatus = useOnlineStore((s) => s.status);
  const onlineErrorMessage = useOnlineStore((s) => s.errorMessage);
  const onlineSelectedCard = useOnlineStore((s) => s.selectedCard);
  const onlineValidTargets = useOnlineStore((s) => s.validTargets);
  const onlineSelectCard = useOnlineStore((s) => s.selectCard);
  const onlinePlayMove = useOnlineStore((s) => s.playMove);
  const onlineDiscardDeadCard = useOnlineStore((s) => s.discardDeadCard);
  const leaveRoom = useOnlineStore((s) => s.leaveRoom);
  const notificationMessage = useOnlineStore((s) => s.notificationMessage);
  const clearNotification = useOnlineStore((s) => s.clearNotification);

  // ── Local / Bot Store Bindings ──────────────────────────────────────────────
  const game = useGameStore((s) => s.game);
  const selectedCard = useGameStore((s) => s.selectedCard);
  const validTargets = useGameStore((s) => s.validTargets);
  const isBotThinking = useGameStore((s) => s.isBotThinking);
  const clearSavedGame = useGameStore((s) => s.clearSavedGame);

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
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const isLeavingRef = useRef(false);

  // Audio toggles
  const [sfxOn, setSfxOn] = useState(soundManager.isSoundEnabled());
  const [bgmOn, setBgmOn] = useState(soundManager.isMusicEnabled());

  // ── Unified Data Derivations ────────────────────────────────────────────────
  const activeBoard = isOnline ? onlineGameState?.board : game?.board;

  // Fixed human player in bot mode (fixed human player id is 'player-0')
  const humanPlayer = useMemo(() => {
    if (isOnline || !game || game.settings.mode !== 'bot') return null;
    return game.players.find((p) => p.id === 'player-0') ?? game.players[0] ?? null;
  }, [isOnline, game]);

  // Active hand displayed in the bottom hand tray:
  // - Online: personal secret hand from server
  // - Bot mode: ALWAYS the fixed human player's hand (never a bot's hand)
  // - Pass-and-play: current player's hand (revealed after tapping reveal cover)
  const activeHand = isOnline
    ? (onlineGameState?.hand ?? [])
    : (game?.settings.mode === 'bot'
        ? (humanPlayer?.hand ?? [])
        : (getCurrentPlayer()?.hand ?? []));

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
  const isHumanTurn = isOnline
    ? isMyTurnOnline
    : game?.settings.mode === 'bot'
    ? (game.currentPlayerIndex === 0 && !isBotThinking)
    : (!isBot && !isBotThinking && !passCoverVisible);

  const canInteract = isHumanTurn;

  const activeSelectedCard = canInteract ? (isOnline ? onlineSelectedCard : selectedCard) : null;
  const activeValidTargets = canInteract ? (isOnline ? onlineValidTargets : validTargets) : [];
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

  // Unified players for DiscardSheet (NEVER pass bot hands to visible components!)
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
    if (game) {
      return game.players.map((p, idx) => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        teamId: p.teamId,
        // In bot mode, make sure bot hands are NEVER passed to DiscardSheet!
        hand: (game.settings.mode === 'bot' && idx > 0) ? [] : p.hand,
        discardPile: p.discardPile || [],
        isBot: game.settings.mode === 'bot' ? idx > 0 : false,
      }));
    }
    return [];
  }, [isOnline, onlineGameState, game]);

  // Sanitized players for GameIntroAnimation (strip bot hands)
  const playersForIntro = useMemo(() => {
    if (!game) return [];
    return game.players.map((p, idx) => ({
      ...p,
      hand: (game.settings.mode === 'bot' && idx > 0) ? [] : p.hand,
    }));
  }, [game]);

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

  // ── Exit & Navigation Interception ──────────────────────────────────────────
  const handleSaveAndExit = async () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    setExitModalVisible(false);
    clearBotTimer();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (game) {
      await storage.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify(game));
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const handleLeaveWithoutSaving = async () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    setExitModalVisible(false);
    clearBotTimer();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    await clearSavedGame();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const handleLeaveOnline = () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    setExitModalVisible(false);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    leaveRoom();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  // Intercept hardware back button & swipe-back gesture
  useEffect(() => {
    const onBackPress = () => {
      if (isLeavingRef.current || activeWinner) return false;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      setExitModalVisible(true);
      return true;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    const unsubBeforeRemove = navigation.addListener('beforeRemove', (e) => {
      if (isLeavingRef.current || activeWinner) {
        return;
      }
      e.preventDefault();
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      setExitModalVisible(true);
    });

    return () => {
      backSub.remove();
      unsubBeforeRemove();
    };
  }, [navigation, activeWinner]);

  // Auto-dismiss server notification banner after 4 seconds
  useEffect(() => {
    if (notificationMessage) {
      const timer = setTimeout(() => {
        clearNotification();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notificationMessage, clearNotification]);

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


        {/* Server Notification Toast (e.g. "{Player} left the match") */}
        {notificationMessage && (
          <View style={styles.notificationToast}>
            <Text style={styles.notificationToastText}>ℹ️ {notificationMessage}</Text>
            <TouchableOpacity
              onPress={clearNotification}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.notificationDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Top Navigation & Status Bar */}
        <View style={styles.topBar}>
          {/* Tier 1: Header row with Exit, RoomCodePill, Sound and Score badges */}
          <View style={styles.topHeaderRow}>
            <View style={styles.topHeaderLeft}>
              {/* Menu / Exit Button */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.exitMenuBtn}
                onPress={() => setExitModalVisible(true)}
                accessibilityLabel="Leave match"
                accessibilityRole="button"
              >
                <Text style={styles.exitMenuBtnText}>✕</Text>
              </TouchableOpacity>

              {/* In Online Mode: Always-Visible Room Code Pill */}
              {isOnline && <RoomCodePill roomCode={onlineRoomCode} compact />}
            </View>

            {/* Sequence Score Badges & Audio Toggles */}
            <View style={styles.scoresRow}>
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

          {/* Tier 2: Turn Indicator & Status Text - dedicated full-width horizontal bar */}
          <View style={styles.turnStatusBar}>
            <View style={styles.turnBadgeContainer}>
              <View style={[styles.playerChipCircle, { backgroundColor: activeTeamColor }]}>
                <Text style={styles.playerChipText}>
                  {isOnline ? (onlineTurnPlayer?.seat ?? 0) + 1 : (currentPlayer?.seat ?? 0) + 1}
                </Text>
              </View>
              <View style={styles.turnNameWrapper}>
                <Text
                  style={styles.turnName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  adjustsFontSizeToFit
                >
                  {activePlayerName} {isOnline && isMyTurnOnline ? '(You)' : ''}
                </Text>
                <Text
                  style={[styles.teamSubtext, { color: activeTeamColor }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  adjustsFontSizeToFit
                >
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

            {/* Online Connection Status Indicator */}
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
                <Text
                  style={[
                    styles.reconnectingDotText,
                    onlineStatus === 'connected' && { color: '#86EFAC' },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {onlineStatus === 'connected'
                    ? 'Online'
                    : onlineStatus === 'connecting'
                    ? 'Reconnecting...'
                    : 'Offline'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Opponents / Players Row (Shows card counts with face-down cards in Bot Mode and Online) */}
        {((isOnline && onlineGameState) || (!isOnline && game?.settings.mode === 'bot')) && (
          <View style={styles.opponentsRowWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.opponentsScroll}
            >
              {isOnline && onlineGameState
                ? onlineGameState.players.map((p) => {
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
                        <View style={styles.opponentTextWrapper}>
                          <View style={styles.playerStatusNameRow}>
                            <View
                              style={[
                                styles.playerStatusDot,
                                { backgroundColor: p.isConnected ? '#22C55E' : '#94A3B8' },
                              ]}
                            />
                            <Text
                              style={styles.opponentPillName}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              adjustsFontSizeToFit
                            >
                              {p.name} {isMe ? '(You)' : ''}
                            </Text>
                          </View>
                          <Text
                            style={styles.opponentCardCount}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {isMe ? `${activeHand.length} cards` : `🂠 ${p.cardCount} cards`}
                            {p.isBotControlled ? ' • 🤖' : ''}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                : game?.players.map((p, idx) => {
                    const isMe = idx === 0;
                    const isTurn = idx === game.currentPlayerIndex;
                    const isCurrentBotThinking = isTurn && !isMe && isBotThinking;
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
                          isTurn && { borderColor: teamColor, backgroundColor: 'rgba(255, 255, 255, 0.14)' },
                          isMe && styles.myPill,
                        ]}
                      >
                        <View style={[styles.miniSeatDot, { backgroundColor: teamColor }]}>
                          <Text style={styles.miniSeatText}>{p.seat + 1}</Text>
                        </View>
                        <View style={styles.opponentTextWrapper}>
                          <Text
                            style={styles.opponentPillName}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            adjustsFontSizeToFit
                          >
                            {p.name} {isMe ? '(You)' : ''}
                          </Text>
                          <Text
                            style={styles.opponentCardCount}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {isMe
                              ? `${p.hand.length} cards`
                              : `🂠 ${p.hand.length} cards`}
                            {!isMe && isCurrentBotThinking
                              ? ' • 🤖 Thinking...'
                              : !isMe
                              ? ' • 🤖'
                              : ''}
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
              <Text
                style={styles.selectionHint}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
              >
                Tap a highlighted board cell to place chip
              </Text>
            ) : isOnline && !isMyTurnOnline ? (
              <Text
                style={styles.waitTurnHint}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
              >
                Waiting for {activePlayerName}'s turn...
              </Text>
            ) : !isOnline && game?.settings.mode === 'bot' && isBotThinking ? (
              <Text
                style={styles.thinkingHint}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
              >
                🤖 {activePlayerName} is thinking...
              </Text>
            ) : !isOnline && game?.settings.mode === 'bot' && game.currentPlayerIndex > 0 ? (
              <Text
                style={styles.waitTurnHint}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
              >
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
          players={playersForIntro}
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

      {/* Pass-and-Play Privacy Cover for Friends Mode (LOCAL ONLY, never in bot mode or online mode) */}
      {!isOnline && game?.settings.mode === 'local' && (
        <PassAndPlayCover
          visible={passCoverVisible && !introVisible}
          playerName={activePlayerName}
          playerSeat={currentPlayer?.seat ?? 0}
          teamId={activeTeam}
          onReveal={() => setPassCoverVisible(false)}
        />
      )}

      {/* Leave Match Confirmation Modal */}
      <Modal
        visible={exitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave match?</Text>
            <Text style={styles.modalSubtitle}>
              {isOnline
                ? 'Leaving this match will let an AI bot take over your seat. Other players will be notified.'
                : 'Do you want to save your match and resume later, or leave and end the game?'}
            </Text>

            <View style={styles.modalActions}>
              {!isOnline && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.modalBtn, styles.saveExitBtn]}
                  onPress={handleSaveAndExit}
                >
                  <Text style={styles.saveExitBtnText}>💾 Save & Exit</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.modalBtn, styles.leaveBtn]}
                onPress={isOnline ? handleLeaveOnline : handleLeaveWithoutSaving}
              >
                <Text style={styles.leaveBtnText}>
                  {isOnline ? 'Leave Match' : 'Leave without saving'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setExitModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Server Restarted / Room Closed Modal */}
      <Modal
        visible={Boolean(isOnline && onlineErrorMessage)}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: '#F87171' }]}>Match Unavailable</Text>
            <Text style={styles.modalSubtitle}>
              {onlineErrorMessage || 'The match has ended or the server restarted.'}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.modalBtn, styles.leaveBtn, { backgroundColor: palette.gold }]}
                onPress={() => {
                  leaveRoom();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                  });
                }}
              >
                <Text style={[styles.leaveBtnText, { color: '#071624', fontWeight: '800' }]}>
                  Return to Home
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(10, 20, 32, 0.88)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    gap: 6,
  },
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  turnStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
    gap: spacing.sm,
  },
  exitMenuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  exitMenuBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  turnBadgeContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  turnNameWrapper: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  notificationToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderLeftWidth: 4,
    borderLeftColor: palette.gold,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.base,
    marginTop: spacing.xs,
    borderRadius: radius.sm,
  },
  notificationToastText: {
    ...typography.body,
    fontSize: 13,
    color: '#F8FAFC',
    flex: 1,
  },
  notificationDismiss: {
    color: '#94A3B8',
    fontSize: 16,
    paddingLeft: spacing.sm,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reconnectingDotText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
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
  opponentTextWrapper: {
    flexShrink: 1,
    minWidth: 0,
  },
  playerStatusNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  playerStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  opponentPillName: {
    ...typography.caption,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    maxWidth: 110,
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
    gap: spacing.sm,
  },
  handTitle: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: palette.gold,
    letterSpacing: 1.5,
    flexShrink: 0,
  },
  selectionHint: {
    ...typography.caption,
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  waitTurnHint: {
    ...typography.caption,
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  thinkingHint: {
    ...typography.caption,
    fontSize: 11,
    color: palette.gold,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.body,
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  modalActions: {
    width: '100%',
    gap: spacing.sm,
  },
  modalBtn: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  saveExitBtn: {
    backgroundColor: palette.gold,
  },
  saveExitBtnText: {
    ...typography.button,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '800',
  },
  leaveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  leaveBtnText: {
    ...typography.button,
    fontSize: 14,
    color: '#FCA5A5',
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelBtnText: {
    ...typography.button,
    fontSize: 14,
    color: '#E2E8F0',
  },
});

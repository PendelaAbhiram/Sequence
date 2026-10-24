// ─────────────────────────────────────────────────────────────────────────────
// Sequence – Online Multiplayer Lobby Screen
// Live player list, team assignments, host controls, code sharing & animations
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Share,
  Animated,
  Easing,
  Alert,
  BackHandler,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ScreenBackground, GlassPanel, PrimaryButton, ScreenHeader } from '../components';
import { palette, radius, spacing, typography } from '../theme';
import { ScreenProps } from './types';
import { useOnlineStore } from '../store/onlineStore';
import { soundManager } from '../utils/audio';

const ALLOWED_PLAYER_COUNTS = [2, 3, 4, 6, 8, 9, 10, 12];

export const LobbyScreen: React.FC<ScreenProps<'Lobby'>> = ({ navigation }) => {
  const room = useOnlineStore((s) => s.room);
  const playerId = useOnlineStore((s) => s.playerId);
  const status = useOnlineStore((s) => s.status);
  const gameState = useOnlineStore((s) => s.gameState);
  const errorMessage = useOnlineStore((s) => s.errorMessage);
  const clearError = useOnlineStore((s) => s.clearError);

  const setTeamCount = useOnlineStore((s) => s.setTeamCount);
  const startGame = useOnlineStore((s) => s.startGame);
  const leaveRoom = useOnlineStore((s) => s.leaveRoom);

  const [isStarting, setIsStarting] = useState(false);

  // Pulse animation for "waiting for players"
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const radar = Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );

    pulse.start();
    radar.start();

    return () => {
      pulse.stop();
      radar.stop();
    };
  }, [pulseAnim, radarAnim]);

  // Navigate to Game when room starts playing or gameState is received
  useEffect(() => {
    if (room?.status === 'playing' || gameState !== null) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      navigation.navigate('Game');
    }
  }, [room?.status, gameState, navigation]);

  if (!room) {
    return (
      <ScreenBackground>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No active room found.</Text>
          <PrimaryButton
            title="Return to Home"
            variant="gold"
            onPress={() => navigation.navigate('Home')}
          />
        </View>
      </ScreenBackground>
    );
  }

  const isHost = room.hostId === playerId;
  const players = room.players || [];
  const teamCount = room.settings.teamCount || 2;
  const playerCount = players.length;

  const isValidCount =
    ALLOWED_PLAYER_COUNTS.includes(playerCount) && playerCount % teamCount === 0;

  const handleShareCode = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    try {
      await Share.share({
        message: `Join my Sequence game! Room code: ${room.roomCode}`,
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  const handleToggleTeams = async (targetTeamCount: 2 | 3) => {
    if (!isHost || targetTeamCount === teamCount) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    await setTeamCount(targetTeamCount);
  };

  const handleStartGame = async () => {
    if (!isHost || !isValidCount || isStarting) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    setIsStarting(true);
    const result = await startGame();
    if (!result.success) {
      setIsStarting(false);
      Alert.alert('Cannot Start Game', result.error || 'Please verify players and team counts.');
    }
  };

  const isLeavingRef = useRef(false);

  const handleLeave = async () => {
    if (isLeavingRef.current) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    isLeavingRef.current = true;
    await leaveRoom();
    navigation.navigate('Home');
  };

  useEffect(() => {
    const onBackPress = () => {
      handleLeave();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (isLeavingRef.current) return;
      e.preventDefault();
      handleLeave();
    });
    return () => {
      sub.remove();
      unsub();
    };
  }, [navigation]);

  const getTeamColor = (t: string) => {
    if (t === 'red') return palette.red;
    if (t === 'blue') return palette.blue;
    return palette.green;
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Connection Status & Back Button */}
        <ScreenHeader
          title="MATCH LOBBY"
          subtitle={isHost ? 'Host controls & player roster' : 'Waiting for host to start'}
          onBack={handleLeave}
          backLabel="‹ Leave"
          rightAction={
            <View style={styles.connectionStatus}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      status === 'connected'
                        ? '#22C55E'
                        : status === 'connecting'
                        ? '#F59E0B'
                        : '#EF4444',
                  },
                ]}
              />
              <Text style={styles.statusLabel}>
                {status === 'connected'
                  ? 'Online'
                  : status === 'connecting'
                  ? 'Connecting...'
                  : 'Offline'}
              </Text>
            </View>
          }
        />

        {/* Room Code Showcase */}
        <View style={styles.roomCodeCard}>
          <Text style={styles.roomCodeTitle}>ROOM CODE</Text>
          <View style={styles.codeRow}>
            {room.roomCode.split('').map((char, i) => (
              <View key={i} style={styles.codeCharBox}>
                <Text style={styles.codeCharText}>{char}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleShareCode}
            style={styles.shareBtn}
          >
            <Text style={styles.shareBtnIcon}>🔗</Text>
            <Text style={styles.shareBtnText}>Share Room Code</Text>
          </TouchableOpacity>
        </View>

        {/* Error message banner if any */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={clearError}>
              <Text style={styles.errorDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Host Controls: Number of Teams */}
        {isHost && (
          <GlassPanel style={styles.hostControlPanel}>
            <Text style={styles.panelTitle}>TEAMS CONFIGURATION</Text>
            <View style={styles.teamToggleRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.teamToggleBtn,
                  teamCount === 2 && styles.teamToggleBtnActive,
                ]}
                onPress={() => handleToggleTeams(2)}
              >
                <View style={styles.chipRow}>
                  <View style={[styles.miniChip, { backgroundColor: palette.red }]} />
                  <View style={[styles.miniChip, { backgroundColor: palette.blue }]} />
                </View>
                <Text
                  style={[
                    styles.teamToggleText,
                    teamCount === 2 && styles.teamToggleTextActive,
                  ]}
                >
                  2 Teams
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.teamToggleBtn,
                  teamCount === 3 && styles.teamToggleBtnActive,
                ]}
                onPress={() => handleToggleTeams(3)}
              >
                <View style={styles.chipRow}>
                  <View style={[styles.miniChip, { backgroundColor: palette.red }]} />
                  <View style={[styles.miniChip, { backgroundColor: palette.blue }]} />
                  <View style={[styles.miniChip, { backgroundColor: palette.green }]} />
                </View>
                <Text
                  style={[
                    styles.teamToggleText,
                    teamCount === 3 && styles.teamToggleTextActive,
                  ]}
                >
                  3 Teams
                </Text>
              </TouchableOpacity>
            </View>
          </GlassPanel>
        )}

        {/* Players List with Team Colors */}
        <GlassPanel style={styles.playersPanel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>
              PLAYERS IN LOBBY ({playerCount}/{room.settings.maxPlayers || 12})
            </Text>
            <Text style={styles.seatNote}>Seating alternates teams</Text>
          </View>

          <View style={styles.playersList}>
            {players.map((p, index) => {
              const teamColor = getTeamColor(p.teamId);
              const isCurrentMe = p.id === playerId;

              return (
                <View
                  key={p.id}
                  style={[
                    styles.playerRow,
                    isCurrentMe && styles.playerRowCurrent,
                  ]}
                >
                  {/* Seat and Team Badge */}
                  <View style={styles.playerLeft}>
                    <View
                      style={[
                        styles.teamPill,
                        { backgroundColor: teamColor },
                      ]}
                    >
                      <Text style={styles.teamPillText}>Seat {p.seat + 1}</Text>
                    </View>

                    <View>
                      <View style={styles.playerNameRow}>
                        <Text style={styles.playerName}>
                          {p.name} {isCurrentMe && '(You)'}
                        </Text>
                        {p.isHost && (
                          <View style={styles.hostBadge}>
                            <Text style={styles.hostBadgeText}>👑 Host</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.teamSubtext, { color: teamColor }]}>
                        Team {p.teamId.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Status Indicator */}
                  <View style={styles.playerRight}>
                    {p.isConnected ? (
                      <View style={styles.readyIndicator}>
                        <View style={styles.readyDot} />
                        <Text style={styles.readyText}>Ready</Text>
                      </View>
                    ) : (
                      <View style={styles.disconnectedIndicator}>
                        <Text style={styles.disconnectedText}>
                          {p.isBotControlled ? '🤖 Bot' : 'Offline'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </GlassPanel>

        {/* "Waiting for players" animation & Host Start Button */}
        <View style={styles.actionContainer}>
          {isHost ? (
            <View style={styles.hostActions}>
              <PrimaryButton
                title={isStarting ? 'Starting Game...' : 'Start Game'}
                variant="gold"
                onPress={handleStartGame}
                disabled={!isValidCount || isStarting}
              />

              {!isValidCount && (
                <View style={styles.requirementBox}>
                  <Text style={styles.requirementText}>
                    {playerCount < 2
                      ? `Waiting for players to join... (${playerCount}/${teamCount} min)`
                      : playerCount % teamCount !== 0
                      ? `Need ${teamCount - (playerCount % teamCount)} more player(s) so ${teamCount} teams have equal members.`
                      : `Allowed player counts: ${ALLOWED_PLAYER_COUNTS.join(', ')}.`}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.guestWaitContainer}>
              <Animated.View
                style={[
                  styles.waitingPill,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Text style={styles.waitingDot}>⏳</Text>
                <Text style={styles.waitingText}>
                  Waiting for host to start the game...
                </Text>
              </Animated.View>
            </View>
          )}

          {/* Animated Waiting Radar Indicator */}
          <View style={styles.waitingAnimationWrapper}>
            <Animated.View
              style={[
                styles.radarWave,
                {
                  transform: [
                    {
                      scale: radarAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2.4],
                      }),
                    },
                  ],
                  opacity: radarAnim.interpolate({
                    inputRange: [0, 0.8, 1],
                    outputRange: [0.6, 0.2, 0],
                  }),
                },
              ]}
            />
            <View style={styles.radarCenter}>
              <Text style={styles.radarCenterIcon}>♠</Text>
            </View>
          </View>

          {/* Explicit Leave Room Button */}
          <View style={styles.leaveRoomWrapper}>
            <PrimaryButton
              title="Leave Room"
              variant="outline"
              style={styles.leaveRoomButton}
              textStyle={styles.leaveRoomButtonText}
              onPress={handleLeave}
            />
          </View>
        </View>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.subtitle,
    color: '#94A3B8',
  },
  header: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.sm,
  },
  backBtnText: {
    ...typography.caption,
    color: '#CBD5E1',
    fontWeight: '700',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: radius.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    ...typography.caption,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  roomCodeCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: palette.gold,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  roomCodeTitle: {
    ...typography.caption,
    color: palette.gold,
    letterSpacing: 3,
    fontWeight: '800',
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  codeCharBox: {
    width: 44,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 200, 76, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCharText: {
    ...typography.h2,
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245, 200, 76, 0.2)',
    borderWidth: 1,
    borderColor: palette.gold,
  },
  shareBtnIcon: {
    fontSize: 16,
  },
  shareBtnText: {
    ...typography.subtitle,
    fontSize: 14,
    fontWeight: '800',
    color: palette.gold,
  },
  errorBanner: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    ...typography.caption,
    color: '#FCA5A5',
    flex: 1,
  },
  errorDismiss: {
    color: '#FCA5A5',
    fontSize: 16,
    paddingLeft: spacing.sm,
  },
  hostControlPanel: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.md,
    gap: spacing.sm,
  },
  panelTitle: {
    ...typography.caption,
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  teamToggleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  teamToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  teamToggleBtnActive: {
    backgroundColor: 'rgba(245, 200, 76, 0.18)',
    borderColor: palette.gold,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 4,
  },
  miniChip: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  teamToggleText: {
    ...typography.subtitle,
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  teamToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  playersPanel: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.md,
    gap: spacing.sm,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  seatNote: {
    ...typography.caption,
    fontSize: 10,
    color: '#64748B',
  },
  playersList: {
    gap: spacing.xs,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  playerRowCurrent: {
    borderColor: 'rgba(245, 200, 76, 0.4)',
    backgroundColor: 'rgba(245, 200, 76, 0.08)',
  },
  playerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  teamPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  teamPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    ...typography.subtitle,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hostBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(245, 200, 76, 0.25)',
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.gold,
  },
  teamSubtext: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  playerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  readyText: {
    ...typography.caption,
    fontSize: 11,
    color: '#86EFAC',
    fontWeight: '600',
  },
  disconnectedIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  disconnectedText: {
    ...typography.caption,
    fontSize: 10,
    color: '#F87171',
    fontWeight: '700',
  },
  actionContainer: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: spacing.md,
  },
  hostActions: {
    width: '100%',
    gap: spacing.xs,
  },
  requirementBox: {
    padding: spacing.xs,
    alignItems: 'center',
  },
  requirementText: {
    ...typography.caption,
    fontSize: 12,
    color: '#F59E0B',
    textAlign: 'center',
  },
  guestWaitContainer: {
    width: '100%',
    alignItems: 'center',
  },
  waitingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 200, 76, 0.4)',
  },
  waitingDot: {
    fontSize: 16,
  },
  waitingText: {
    ...typography.subtitle,
    fontSize: 13,
    color: palette.gold,
    fontWeight: '700',
  },
  waitingAnimationWrapper: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  radarWave: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: palette.gold,
  },
  radarCenter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 200, 76, 0.25)',
    borderWidth: 1,
    borderColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCenterIcon: {
    fontSize: 14,
    color: palette.gold,
  },
  leaveRoomWrapper: {
    width: '100%',
    marginTop: spacing.md,
  },
  leaveRoomButton: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  leaveRoomButtonText: {
    color: '#FCA5A5',
  },
});
